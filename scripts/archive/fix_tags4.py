#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""精准修复 PortfolioPage.tsx 闭合标签"""

file_path = 'apps/dsa-web/src/pages/PortfolioPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"修复前: {len(lines)} 行")

# 查看 1837-1850 行
for i in range(1836, min(1852, len(lines))):
    print(f"{i+1:4d}: |{lines[i].rstrip()}|")

# 从 1838 行开始，删除多余的 </div>
# 当前 1838-1847 有 10 行多余的，应该只保留 1838 一个 </div>
# 即删除 1839-1848（索引 1838-1847）
del lines[1838:1848]

print(f"\n修复后: {len(lines)} 行")
for i in range(1836, min(1844, len(lines))):
    print(f"{i+1:4d}: |{lines[i].rstrip()}|")

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('\n✅ 完成！')
