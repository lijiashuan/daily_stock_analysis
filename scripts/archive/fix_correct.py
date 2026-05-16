#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""精准修复 PortfolioPage.tsx 闭合标签 - 最终版"""

file_path = 'apps/dsa-web/src/pages/PortfolioPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"修复前: {len(lines)} 行")
print("1837-1852 行:")
for i in range(1836, min(1852, len(lines))):
    print(f"  {i+1}: {lines[i].rstrip()}")

# 正确的结构：
# 1837: </div>          <- closes 1705 space-y-2 (event section content) - 保留
# 1838: </div>          <- closes 1703 div (event section wrapper) - 保留  
# 1839-1847: 多余的 </div> - 需要删除
# 然后需要：
#   </div>              <- closes 1459 space-y-4
#   </Card>             <- closes 1458 Card  
#   </section>          <- closes 1457 section

# 保留 1837-1838，删除 1839-1847 (索引 1838-1846)
del lines[1838:1847]

print("\n删除多余标签后:")
for i in range(1836, min(1852, len(lines))):
    print(f"  {i+1}: {lines[i].rstrip()}")

# 现在 1839 行是 </div>，1840 是 </Card>，1841 是 </section>
# 但缺少关闭 1459 space-y-4 的 </div>
# 在 1838 行后插入 </div> 关闭 space-y-4
lines.insert(1838, "      </div>\n")

print("\n最终结果:")
for i in range(1836, min(1844, len(lines))):
    print(f"  {i+1}: {lines[i].rstrip()}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"\n总行数: {len(lines)}")
print('✅ 修复完成！')
