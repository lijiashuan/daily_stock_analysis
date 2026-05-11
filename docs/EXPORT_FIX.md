# 导出功能修复说明

## 问题描述

启动服务器时出现以下错误：

```
pydantic.errors.PydanticSchemaGenerationError: Unable to generate pydantic-core schema for <class 'api.v1.schemas.history.ExportFormatEnum'>.
```

## 原因分析

`ExportFormatEnum` 最初定义为 `class ExportFormatEnum(str)`，这不是一个有效的枚举类型。Pydantic v2 无法为这种类型生成schema。

## 解决方案

将 `ExportFormatEnum` 改为正确的枚举定义：

```python
from enum import Enum

class ExportFormatEnum(str, Enum):
    """导出格式枚举"""
    MD = "md"
    DOCX = "docx"
    RTF = "rtf"
    HTML = "html"
    PDF = "pdf"
```

**关键修改：**
- 添加 `from enum import Enum` 导入
- 将类定义从 `class ExportFormatEnum(str)` 改为 `class ExportFormatEnum(str, Enum)`

这样既保持了字符串特性（可以在API中作为字符串使用），又是一个合法的枚举类型（Pydantic可以正确处理）。

## 已修复的文件

1. **api/v1/schemas/history.py**
   - 添加了 `from enum import Enum` 导入
   - 修改了 `ExportFormatEnum` 的定义

2. **api/v1/endpoints/history.py**
   - 修正了 Query 参数的默认值语法

## 验证

运行以下命令验证修复：

```bash
# 测试枚举导入
python -c "from api.v1.schemas.history import ExportFormatEnum; print('OK:', ExportFormatEnum.MD)"

# 测试路由导入
python -c "from api.v1.endpoints.history import router; print('OK')"

# 测试应用加载
python -c "from api.app import app; print('OK')"
```

所有命令都应该输出 "OK"。

## 技术说明

### 为什么需要 `str, Enum` 双重继承？

1. **Enum 继承**：使该类成为合法的枚举类型，Pydantic 可以正确识别和验证
2. **str 继承**：保持字符串特性，使得：
   - 在API参数中可以作为字符串传递
   - 可以直接与字符串比较：`format == 'pdf'`
   - 在JSON序列化时自动转换为字符串

### Pydantic v2 的枚举支持

Pydantic v2 对枚举类型有严格要求：
- ✅ `class MyEnum(str, Enum)` - 字符串枚举（推荐）
- ✅ `class MyEnum(Enum)` - 普通枚举
- ❌ `class MyEnum(str)` - 不是枚举，Pydantic无法处理

## 后续建议

如果将来需要添加新的枚举类型，请遵循以下模式：

```python
from enum import Enum

class MyNewEnum(str, Enum):
    OPTION_A = "option_a"
    OPTION_B = "option_b"
```

这样可以确保与Pydantic v2完全兼容。
