# hi3d-papercraft

构建手工立体书纸艺（Pop-up Papercraft）风格的交互场景、网页、动画与多画幅视频：以 `Three.js` 折纸结构、移轴微距镜头和世界环境色软阴影为主体（85%–90%），支持通过 `hi3d` MCP（`Nano-Banana-Pro` 多视图 → `v3.0 master`）全自动直出点睛 3D `GLB` 资产（10%–15%），并通过局部着色器注入实现 3D 模型与纸艺世界的无冲突光影同化。

适用于制作立体书微缩游戏、IP 场景巡礼（如《塞尔达传说：时之笛》微缩立体画卷）、交互网页及竖屏/横屏动画视频；不用于生成真实裁剪折纸图纸或普通文档排版。

## 安装

```bash
npx -y skills add SucRunBug/hi3d-papercraft -g --all
```

## 快速使用

安装后，可直接在支持 Agent Skills 且挂载了 `hi3d` MCP 的客户端中调用：

> 使用 `$hi3d-papercraft` 制作一个融合手工立体书纸艺与点睛 3D 资产的微缩交互场景。

本地预览内置 `Three.js` 立体书模板：

```bash
python3 -m http.server -d skills/hi3d-papercraft/assets 8000
# 浏览器访问 http://localhost:8000/templates/popup-3d/
```

## 核心能力

- **原汁原味立体书底座**：完整保留纤维哑光卡纸、多层套色拼贴印刷、受光侧裁切高光边、折痕弹簧铰链（`FlapSpring`）、俯视移轴微距景深（`PaperPost`）、程序化纸张音效（`PaperSound`）与环境动态生命（`paper-life.js`）。
- **零冲突 3D 资产光影同化（`paper-3d-assets.js`）**：提供 `craft-matte`（死哑光彩绘纸塑）与 `relic-satin`（局部柔和 `PMREM` 圣物微光泽）双档同化，共享 `PAPER_LIGHT` 包裹漫反射与昼/暮/夜彩色阴影，自动完成厘米制包围盒接地与折痕铰链挂载（`H.popupAsset` / `H.placeAsset`）。
- **`hi3d` MCP 旗舰模型直出**：内置多视图生图至 `v3.0 master` 的免确认自动生成与 `glTF` 魔数校验落盘脚本（`scripts/fetch_hi3d_asset.py`），并与确定性无头截图/录屏质检工具（`scripts/capture.py`、`scripts/measure.py`）无缝握手。

## 运行依赖

- 支持 Agent Skills 的智能体客户端
- `hi3d` MCP 服务（用于在线生成 3D `GLB` 资产；仅使用本地已有 `.glb` 或纯纸艺模式时可选）
- Python 3（`measure.py` 需 `numpy`、`Pillow`；`capture.py` 需 `playwright`，导出 `MP4` 需 `ffmpeg`）

## 参考与致谢

本 Skill 的立体书视觉法则、运行时底座与质检工具参考并基于 [@xikhar](https://github.com/xikhar) 的开源项目改造扩展：

- 参考仓库：[https://github.com/xikhar/papercraft](https://github.com/xikhar/papercraft)
- 开源协议：[MIT License](LICENSE)
