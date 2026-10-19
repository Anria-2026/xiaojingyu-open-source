# 代码定位与验收

以下路径均相对项目根目录；先确认当前版本实际存在的模块。

## 从需求找到代码

| 需求所在层 | 优先搜索 |
|---|---|
| 本地启动、Python 准备 | 根目录两个启动 bat、`tools/launch_local.*`、`tools/start_local.py`、`tools/python-bootstrap.json` |
| 游戏页面与脚本加载 | `h5_demo/index.html`，其中的脚本清单与加载器 |
| 开始菜单、存档选择、图册入口 | `h5_demo/js/menu.js`、`h5_demo/js/features/gallery.js` |
| 玩法状态、阶段、训练和结算 | `h5_demo/js/game_core.js`、`h5_demo/js/v35_core.js` |
| 页面渲染与具体功能 | `h5_demo/js/game_ui.js`、`h5_demo/js/features/` 及相关样式 |
| 存档格式、恢复和迁移 | `h5_demo/js/game_save.js`，成就另见 `achieve_store.js` |
| 本地文件存档传输与落盘 | `h5_demo/dev_server.py`、`local_saves.py`、`local_save_config.json`、`js/local_save_storage.js` |
| 编辑器读写与服务 | `editor/server.py`、`editor/` 中相应分页模块 |

用用户能看到的文字或稳定配置键搜索，再沿调用链定位。初次检索可排除 `**/legacy/**`，防止命中派生压缩代码；任务确实涉及旧 WebView 时再查兼容构建链路。修改前核对未提交内容，避免覆盖用户或其他协作者的改动。

## 界面与演出

先复用现有组件、布局和动效。检查真实窗口中的按钮可点击性、文本溢出、焦点和弹窗层级；事件推进应符合该演出现有的按钮规则。不要通过关闭遮挡或放大点击区域，意外让背景点击也推进剧情。

涉及结算、奖励、图册或动画时，关注重复触发：刷新、暂停、隐藏页面、读档和只读预览不能重复支付奖励或消耗首次揭晓资格。媒体保留自身比例；排行榜没有真实数据时隐藏，不添加虚构排名。

## 存档约束

本地游戏服务将存档放在项目 `saves/storage.json`，浏览器音量等偏好仍在浏览器。第一次导入当前本地网址的浏览器旧档，之后文件优先；删除的槽位不能被旧浏览器记录补回。

读档必须遵循原存档校验和迁移，不能把未知未来格式当空档覆盖。文件写入要有原子提交与冲突检测；失败时保留原文件并明确失败，不把“进入写入队列”当作保存成功。测试使用独立临时目录和合成存档，不读写玩家实际存档。

静态或平台部署继续走原有存储方式。本地后端适配由专用服务器注入，不将文件 API 当作所有部署环境都具备的功能。

## 选择验收范围

| 改动 | 当前仓库可用的检查示例 |
|---|---|
| 游戏配置链路 | `node h5_demo/audit_cfg_sync.js` |
| 存档升级与恢复 | `node h5_demo/test_save_migrate.js`、`node h5_demo/test_save_restore_atomic.js` |
| 本地文件存档 | `python h5_demo/test_local_saves.py`、`node h5_demo/test_local_save_storage.js` |
| 图册首次揭晓账本 | `node h5_demo/test_gallery_special_ledger.js` |
| 引擎与实际配置流程 | `node h5_demo/test_v35.js`、`node h5_demo/test_fullflow.js 20` |

先确认脚本存在，并阅读相应测试是否会写配置。按本次范围选择检查，再在现代浏览器中实际触发效果；不要默认运行全部内部回归。只有用户要求或反复排查仍无法定位时再考虑仓库可用的全量入口。

服务端代码修改后重启对应服务；客户端代码修改后核对当前加载源与缓存版本。若交付还要求旧 WebView 支持，按当前兼容构建流程生成派生产物；不要手改压缩结果。
