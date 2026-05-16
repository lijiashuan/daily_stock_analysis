#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""修复 PortfolioPage.tsx 闭合标签"""

file_path = 'apps/dsa-web/src/pages/PortfolioPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 当前 1837-1850 的内容
print("修复前 1837-1852 行:")
for i in range(1836, min(1852, len(lines))):
    print(f"  {i+1}: {lines[i].rstrip()}")

# 正确的结构应该是从 1838 行开始替换
# 1837: </div>  保留 (关闭 1705 的 space-y-2)
# 1838: </div>  关闭 1703 事件记录区域
# 1839: </div>  关闭 1459 space-y-4  
# 1840: </Card>
# 1841: </section>

# 删除 1838-1850 (索引 1837-1849)，替换为正确的闭合
del lines[1837:1850]

# 在 1837 行后插入正确的闭合
closing = [
    "          </div>\n",      # closes 1703 event section div
    "      </div>\n",          # closes 1459 space-y-4
    "    </Card>\n",           # closes 1458 Card
    "  </section>\n",          # closes 1457 section
]

for j, line in enumerate(closing):
    lines.insert(1837 + j, line)

print("\n修复后 1837-1844 行:")
for i in range(1836, min(1844, len(lines))):
    print(f"  {i+1}: {lines[i].rstrip()}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"\n总行数: {len(lines)}")
print('✅ 修复完成！')
