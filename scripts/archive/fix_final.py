#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""最终修复 - 精确匹配闭合标签"""

file_path = 'apps/dsa-web/src/pages/PortfolioPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到 "下一页" 按钮后的闭合标签区域
# 当前 1837-1848 行有太多 </div>
# 正确的应该是：
#   1837: </div>  (关闭 1705 space-y-2)
#   1838: </div>  (关闭 1703 事件记录区域)
#   1839: </div>  (关闭 1459 space-y-4)
#   1840: </Card> (关闭 1458 Card)
#   1841: </section> (关闭 1457 section)

old_lines = lines[1837:1850]
print("旧内容:")
for i, line in enumerate(old_lines, start=1838):
    print(f"  {i}: {line.rstrip()}")

# 替换为正确的闭合
new_closing = [
    "          </div>\n",      # closes space-y-2 (event section)
    "        </div>\n",        # closes event section div
      "      </div>\n",        # closes space-y-4 (main container)
    "    </Card>\n",           # closes Card
    "  </section>\n",          # closes section
]

# Replace lines 1837-1849 (index 1837 to 1849) with the correct closing
lines[1837:1850] = new_closing

print("\n新内容:")
for i, line in enumerate(new_closing, start=1838):
    print(f"  {i}: {line.rstrip()}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"\n总行数: {len(lines)}")
print('✅ 修复完成！')
