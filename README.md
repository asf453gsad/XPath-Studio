# XPath 元素选择器

Chrome 浏览器扩展，在任意网页上点选元素并生成/复制 XPath，面向内部数据采集场景。

## 安装方式

1. 打开 `chrome://extensions`
2. 右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本项目根目录
4. 扩展图标出现在工具栏即安装成功

## 快捷键

| 按键 | 功能 |
|------|------|
| E | 开启/关闭选择模式 |
| R | 循环切换 XPath 模式（1→2→3） |
| Q | 切换位置索引格式 `(xpath)[n]`（需先选中元素） |
| C | 复制当前选中元素的 CSS 选择器 |
| W | 选择父元素 |
| → | 选择下一个兄弟元素 |
| - | 聚焦代码输入框 |
| Y | 开关数据自动填充面板 |
| 1/2/3 | 填充面板打开时，应用对应方案到页面 textarea |
| H | 隐藏/恢复页面弹窗和遮罩 |

## 三种 XPath 模式

- **模式 1（precise）**：优先使用稳定属性（data-/id/class），生成最短且抗页面变动的 XPath。
- **模式 2（contains）**：使用 `contains()` 模糊匹配属性片段，适合属性值带动态后缀的场景。
- **模式 3（position）**：优先使用 `//tag` 简洁路径，适合结构简单或需要按标签类型批量定位的场景。

## 目录结构

```
├── manifest.json              # MV3 扩展清单
├── popup.html                 # 弹窗 UI
├── js/
│   ├── xpath-generator.js     # XPath/CSS 生成引擎（挂载到 window.XPathGenerator）
│   ├── content.js             # 页面交互、面板、快捷键（依赖 xpath-generator）
│   ├── background.js          # popup ↔ content 消息中转
│   └── popup.js               # 弹窗按钮逻辑
├── images/                    # 扩展图标
└── README.md
```
