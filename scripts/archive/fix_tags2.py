#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""修复 PortfolioPage.tsx 中的多余闭合标签"""

file_path = 'apps/dsa-web/src/pages/PortfolioPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"修复前总行数: {len(lines)}")
print("1837-1850 行内容:")
for i in range(1836, min(1850, len(lines))):
    print(f"  {i+1}: {lines[i].rstrip()}")

# 需要删除 1840-1847 行（索引 1839-1846）
# 保留 1838-1839 两个 </div>，然后直接接 </div> (space-y-4), </Card>, </section>
del lines[1839:1847]

print(f"\n修复后总行数: {len(lines)}")
print("修复后 1837-1850 行内容:")
for i in range(1836, min(1850, len(lines))):
    print(f"  {i+1}: {lines[i].rstrip()}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('\n✅ 修复完成！')
