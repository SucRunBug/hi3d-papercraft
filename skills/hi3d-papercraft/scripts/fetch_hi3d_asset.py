#!/usr/bin/env python3
"""下载、校验并可选轻量化 hi3d MCP 生成的 GLB 模型资产，固化至场景项目目录并维护 manifest.json。

用法示例：
    python3 scripts/fetch_hi3d_asset.py \\
        --url "https://.../model.glb" \\
        --name "totk-link-hero" \\
        --project "./my-scene" \\
        --task-id "task_xxx" \\
        --page-url "https://www.hi3d.ai/..." \\
        --height 3.55 \\
        --mode craft-matte \\
        --max-tris 26000
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import struct
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
GLB_MAGIC = b"glTF"


def validate_glb_bytes(data: bytes, source_label: str) -> tuple[int, int, int]:
    """校验二进制数据是否为合法的 glTF 2.0 GLB 容器，返回 (version, declared_length, total_triangles)。"""
    if len(data) < 20:
        raise ValueError(f"文件过小（{len(data)} 字节），不是有效的 GLB：{source_label}")
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != GLB_MAGIC:
        preview = data[:32].decode("utf-8", errors="replace").strip()
        raise ValueError(f"GLB 魔数校验失败（实际开头：{preview!r}），链接可能已过期或返回了错误页：{source_label}")
    if length > len(data):
        raise ValueError(f"GLB 文件截断：头部声明 {length} 字节，实际仅下载 {len(data)} 字节")
    clen, ctype = struct.unpack_from("<II", data, 12)
    tris = 0
    if ctype == 0x4E4F534A:  # JSON chunk
        try:
            meta = json.loads(data[20 : 20 + clen])
            accessors = meta.get("accessors", [])
            for mesh in meta.get("meshes", []):
                for prim in mesh.get("primitives", []):
                    if "indices" in prim:
                        tris += accessors[prim["indices"]].get("count", 0) // 3
                    elif "POSITION" in prim.get("attributes", {}):
                        tris += accessors[prim["attributes"]["POSITION"]].get("count", 0) // 3
        except Exception:
            tris = 0
    return version, length, tris


def find_blender_cli() -> str | None:
    """按跨平台标准路径查找可用的无头 Blender CLI（用于高面数模型保 UV 自动减面）。"""
    found = shutil.which("blender")
    if found:
        return found
    candidates = [
        Path("/Applications/Blender.app/Contents/MacOS/Blender"),
        Path.home() / ".local/share/tripo-3d/blender-cli/bin/blender",
    ]
    for cand in candidates:
        if cand.is_file():
            return str(cand)
    return None


def decimate_glb_if_needed(glb_path: Path, cur_tris: int, max_tris: int) -> tuple[int, int]:
    """当 GLB 三角面超过 max_tris 且本机装有 Blender CLI 时，自动执行保 UV 网格简化防止 WebGL 掉帧。"""
    if max_tris <= 0 or cur_tris <= max_tris:
        return glb_path.stat().st_size, cur_tris
    blender_bin = find_blender_cli()
    if not blender_bin:
        print(f"WARN：{glb_path.name} 含 {cur_tris:,} 面（超过 {max_tris:,}），未检测到 Blender CLI，跳过减面。", file=sys.stderr)
        return glb_path.stat().st_size, cur_tris

    out_tmp = glb_path.parent / f".{glb_path.stem}.decimated.glb"
    expr = (
        "import bpy\n"
        "bpy.ops.wm.read_factory_settings(use_empty=True)\n"
        f"bpy.ops.import_scene.gltf(filepath={str(glb_path)!r})\n"
        f"target = {int(max_tris)}\n"
        "meshes = [o for o in bpy.data.objects if o.type == 'MESH']\n"
        "total = sum(len(o.data.polygons) for o in meshes) or 1\n"
        "if total > target:\n"
        "    ratio = target / float(total)\n"
        "    for o in meshes:\n"
        "        if len(o.data.polygons) > 200:\n"
        "            bpy.context.view_layer.objects.active = o\n"
        "            m = o.modifiers.new(name='WebDecimate', type='DECIMATE')\n"
        "            m.decimate_type = 'COLLAPSE'\n"
        "            m.ratio = max(0.002, min(1.0, ratio))\n"
        "            m.use_collapse_triangulate = True\n"
        "            bpy.ops.object.modifier_apply(modifier=m.name)\n"
        "bpy.ops.export_scene.gltf(\n"
        f"    filepath={str(out_tmp)!r},\n"
        "    export_format='GLB',\n"
        "    export_image_format='WEBP',\n"
        "    export_image_quality=88,\n"
        "    export_texcoords=True,\n"
        "    export_normals=True,\n"
        "    export_materials='EXPORT',\n"
        ")\n"
    )
    proc = subprocess.run([blender_bin, "--background", "--python-expr", expr], capture_output=True, text=True)
    if proc.returncode == 0 and out_tmp.is_file():
        data = out_tmp.read_bytes()
        _, new_len, new_tris = validate_glb_bytes(data, str(out_tmp))
        shutil.move(str(out_tmp), str(glb_path))
        print(f"INFO：已保 UV 轻量化 {glb_path.name}：{cur_tris:,} 面 -> {new_tris:,} 面（{new_len / 1048576:.2f} MB）")
        return new_len, new_tris
    if out_tmp.exists():
        out_tmp.unlink()
    print(f"WARN：Blender 减面未生效，保留原模型（{cur_tris:,} 面）", file=sys.stderr)
    return glb_path.stat().st_size, cur_tris


def read_source_bytes(url_or_path: str, timeout: int) -> bytes:
    """支持从 HTTP(S) URL 下载或从本地文件路径复制读取。"""
    parsed = urllib.parse.urlparse(url_or_path)
    if parsed.scheme in ("http", "https"):
        req = urllib.request.Request(
            url_or_path,
            headers={"User-Agent": "hi3d-papercraft-fetcher/1.1"},
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.URLError as exc:
            raise RuntimeError(f"下载 GLB 失败：{exc}") from exc
    src_path = Path(url_or_path).expanduser().resolve()
    if not src_path.is_file():
        raise FileNotFoundError(f"源 GLB 文件不存在：{src_path}")
    return src_path.read_bytes()


def main() -> int:
    parser = argparse.ArgumentParser(description="下载校验并轻量化 hi3d GLB 模型，写入项目 assets/models/manifest.json")
    parser.add_argument("--url", required=True, help="get_task 返回的 GLB 下载链接或本地路径")
    parser.add_argument("--name", required=True, help="资产短名称（小写字母、数字与连字符，如 totk-link-hero）")
    parser.add_argument("--project", required=True, help="目标场景项目的根目录")
    parser.add_argument("--subdir", default="assets/models", help="相对于项目根目录的模型存放子目录（默认 assets/models）")
    parser.add_argument("--task-id", default="", help="hi3d 3D 生成任务 ID，用于查重复用")
    parser.add_argument("--image-task-id", default="", help="关联的 2D 多视图任务 ID")
    parser.add_argument("--page-url", default="", help="hi3d 主站 model_page_url")
    parser.add_argument("--height", type=float, default=3.6, help="场景内目标厘米制高度（默认 3.6，与主角等高）")
    parser.add_argument("--mode", choices=("craft-matte", "relic-satin"), default="craft-matte", help="光影同化档位")
    parser.add_argument("--max-tris", type=int, default=26000, help="单模型最大三角面预算（默认 26000，设 0 禁用减面）")
    parser.add_argument("--timeout", type=int, default=120, help="网络下载超时秒数")
    parser.add_argument("--overwrite", action="store_true", help="若同名 GLB 已存在则覆盖")
    args = parser.parse_args()

    slug = args.name.strip().lower()
    if not SLUG_PATTERN.fullmatch(slug):
        print(f"ERROR：--name {args.name!r} 格式无效，请仅使用小写英文、数字和连字符（如 master-sword）", file=sys.stderr)
        return 1

    project_root = Path(args.project).expanduser().resolve()
    if not project_root.exists():
        print(f"ERROR：项目根目录不存在：{project_root}", file=sys.stderr)
        return 1

    models_dir = project_root / args.subdir
    models_dir.mkdir(parents=True, exist_ok=True)
    target_glb = models_dir / f"{slug}.glb"
    rel_glb = target_glb.relative_to(project_root).as_posix()

    if target_glb.exists() and not args.overwrite:
        try:
            existing = target_glb.read_bytes()
            validate_glb_bytes(existing, str(target_glb))
            print(f"SKIP：已存在有效模型 {rel_glb}（{len(existing)} 字节），如需替换请加 --overwrite")
            return 0
        except Exception:
            pass

    try:
        raw = read_source_bytes(args.url, args.timeout)
        version, length, tris = validate_glb_bytes(raw, args.url)
    except Exception as exc:
        print(f"ERROR：{exc}", file=sys.stderr)
        return 1

    tmp_glb = models_dir / f".{slug}.glb.tmp"
    tmp_glb.write_bytes(raw)
    shutil.move(str(tmp_glb), str(target_glb))

    length, tris = decimate_glb_if_needed(target_glb, tris, args.max_tris)

    manifest_path = models_dir / "manifest.json"
    manifest: dict[str, object] = {"assets": {}}
    if manifest_path.is_file():
        try:
            loaded = json.loads(manifest_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict) and isinstance(loaded.get("assets"), dict):
                manifest = loaded
        except json.JSONDecodeError:
            pass

    assets_map = manifest["assets"]
    assert isinstance(assets_map, dict)
    assets_map[slug] = {
        "name": slug,
        "path": f"./{rel_glb}",
        "gltf_version": version,
        "bytes": length,
        "triangles": tris,
        "height": args.height,
        "mode": args.mode,
        "task_id": args.task_id,
        "image_task_id": args.image_task_id,
        "model_page_url": args.page_url,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"OK：{rel_glb}（glTF v{version}，{length} 字节，{tris:,} 面，mode={args.mode}，height={args.height}）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
