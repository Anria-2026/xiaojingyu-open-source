# 鲸鱼娘养成计划

非官方社区同人游戏，附带本地编辑器与项目专用开发 skill。

## 直接开始

完整下载并解压项目后，Windows 用户双击 **启动游戏.bat**。启动器会检查 Python；缺少时从官网下载校验安装包并打开安装向导，安装完成后继续启动。游戏会在浏览器打开，游玩时保留启动窗口。

想改台词、立绘、地图和配置，双击 **启动编辑器.bat**。首次检查并安装图片处理依赖 Pillow，需要联网。改完点“保存全部”，确认成功后回游戏验证。

Linux 用户双击或终端执行根目录 **启动游戏.sh** / **启动编辑器.sh**。缺少 Python 3.10+ 时启动器会给出对应发行版的安装命令；编辑器缺少 Pillow 时会先询问，输入 `y` 后在项目内创建 `.venv` 并安装。文件管理器不执行 shell 脚本时，运行 `sh tools/install_desktop.sh` 添加应用菜单入口。

存档保存在项目根目录 **saves/storage.json**。保存并关闭游戏后，复制整个 saves 文件夹备份或迁移。已有玩家存档不随源码分发。

详细操作见 [入门与编辑器指南.md](入门与编辑器指南.md)。macOS 与开发者也可手动启动：

```sh
./启动游戏.sh
./启动编辑器.sh
```

或直接调用 Python（需要 3.10+）：

```sh
python3 tools/start_local.py game
python3 tools/start_local.py editor
```

## 与 Agent 协作

用支持访问项目文件的 Agent 打开整个目录，直接描述需求。根目录 [AGENTS.md](AGENTS.md) 会引导它读取 [项目专用 skill](.agents/skills/xiaojingyu-dev-pipeline/SKILL.md)，检索相关配置与代码、实现并验证。不自动发现的工具，可先要求它读取上述文件。

实际游戏入口为 h5_demo/index.html。游戏配置真源为 h5_demo/data/game_cfg.json，编辑器镜像为 editor/game_cfg_config.json；不要用旧页面覆盖 Agent 已修改的配置。

## 目录与检查

- h5_demo/：游戏页面、运行模块、配置、本地存档服务及少量基础检查。
- editor/：地图、文案、音频、界面等编辑工具；高级语音生成需要自己的服务凭据。
- resource/：实际引用的图片、音频、视频，以及动态人物/头像资源。
- tools/：本地启动、Python 检查及配置同步工具。
- .agents/skills/：可分发的项目开发说明。

开发检查需要 Node.js。基础配置审计 `npm run check` 不需额外依赖；DOM 专项检查可先 `npm install` 安装开发依赖。日常游玩与编辑不要求 Node.js。

```sh
node h5_demo/audit_cfg_sync.js
node h5_demo/test_save_restore_atomic.js
python h5_demo/test_local_saves.py
```

修改 JS/CSS 并需要旧 WebView 兼容时，先 `npm ci --prefix tools/legacy-build` 安装固定构建依赖，再 `node tools/build_legacy_webview.js` 重建。只修改 JSON 配置不需要重建；这些依赖不应随游戏资源提交。

音效服务配置示例为 editor/server_config.example.json；自行配置后保存为 server_config.json，并保留在本地。配音凭据可使用 SEED_AUDIO_API_KEY 环境变量；不提交密钥、候选配音、参考音频或生成草稿。

本地玩法不要求连接平台账号；云存档、广告与排行榜依赖平台实际环境。

## 许可与素材

作者有权授权的代码和技术文档使用 [MIT](LICENSE)。作者有权授权的原创素材与创作性文案按 [CC BY-NC-SA 4.0](LICENSE-ASSETS.txt)；第三方内容保留各自权利，见 [NOTICE.txt](NOTICE.txt)。素材不会因为嵌入代码就转为 MIT。

逐文件资源、引用依据与哈希见 [资源清单.csv](资源清单.csv)，完整公开范围见 [开源清单.json](开源清单.json)。具体素材与上游权利仍以许可及 NOTICE 说明为准。

作者：Anria_ / [Anria-2026](https://github.com/Anria-2026)。原形象致谢与许可边界详见 NOTICE.txt。本项目不代表 DeepSeek 官方出品或认可。
