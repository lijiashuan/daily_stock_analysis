#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""修复 PortfolioPage.tsx 闭合标签 - 正确版本"""

file_path = 'apps/dsa-web/src/pages/PortfolioPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"修复前: {len(lines)} 行")
print("1837-1852 行内容:")
for i in range(1836, min(1852, len(lines))):
    print(f"  {i+1}: |{lines[i].rstrip()}|")

# 正确结构应该是（从1837开始）：
# 1837: </div>           <- 关闭 1705 space-y-2
# 1838: </div>           <- 关闭 1703 事件记录div  
# 1839: </div>           <- 关闭 1459 space-y-4
# 1840: </Card>          <- 关闭 1458 Card
# 1841: </section>       <- 关闭 1457 section

# 当前 1838-1847 都是多余的 </div>，需要删除 1838-1847（索引1837-1846）
# 保留1837行的</div>

# 替换 1838-1850 (索引 1837 到 1849) 为正确的闭合
new_closing = [
    "          </div>\n",     # 关闭 1703 事件记录div
    "      </div>\n",         # 关闭 1459 space-y-4
    "    </Card>\n",          # 关闭 1458 Card
    "  </section>\n",         # 关闭 1457 section
]

# 删除索引 1837 到 1849，然后插入正确内容
del lines[1837:1850]

for j, line in enumerate(new_closing):
    lines.insert(1837 + j, line)

print("\n修复后:")
for i in range(1836, min(1845, len(lines))):
    print(f"  {i+1}: |{lines[i].rstrip()}|")

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"\n总行数: {len(lines)}")
print('✅ 修复完成！')
