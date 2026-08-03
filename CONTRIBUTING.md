# Contributing

感谢你关注 Earth Online。这个项目仍处于体验原型阶段，提交修改前请尽量保持现有世界观、存档兼容和轻量结构。

## 本地开发

```bash
npm ci
npm start
```

访问 `http://127.0.0.1:58804/`。旧版回滚入口为 `?experience=legacy`。

## 提交前检查

```bash
npm test
npm run build
git diff --check
```

修改 UI 时，请至少检查桌面端与手机竖屏，并确认首次建档、已有存档和夜间档案都可以正常返回。

## 变更边界

- 不破坏现有 `earth-online-save-v1` 存档兼容。
- 不提交 `node_modules`、`dist`、本地日志或玩家存档。
- 新增第三方代码、纹理、字体或图片时，在 `OPEN_SOURCE_REFERENCES.md` 中记录来源与许可。
- 视觉改动应保持地球是绝对主体，避免重新引入中心大面板或卡片式导航。
- 一个提交只解决一个明确问题，避免夹带无关重构。
