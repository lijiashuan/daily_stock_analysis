#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""恢复 PortfolioPage.tsx 到正确状态"""

file_path = 'apps/dsa-web/src/pages/PortfolioPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"当前: {len(lines)} 行")

# 当前 1837-1841 行的闭合标签缩进不对
# 1842-1854 行 ConfirmDialog 部分丢失/损坏

# 正确的结尾应该是：
correct_ending = [
    "            </div>\n",       # 1837: 关闭 1705 space-y-2
    "          </div>\n",         # 1838: 关闭 1703 事件记录区域div
    "      </div>\n",             # 1839: 关闭 1459 space-y-4
    "    </Card>\n",              # 1840: 关闭 1458 Card
    "  </section>\n",             # 1841: 关闭 1457 section
    "\n",
    "      <ConfirmDialog\n",
    "        isOpen={Boolean(pendingDelete)}\n",
    "        title=\"删除错误流水\"\n",
    "        message={pendingDelete?.message || '确认删除这条流水吗？'}\n",
    "        confirmText={deleteLoading ? '删除中...' : '确认删除'}\n",
    "        cancelText=\"取消\"\n",
    "        isDanger\n",
    "        onConfirm={() => void handleConfirmDelete()}\n",
    "        onCancel={() => {\n",
    "          if (!deleteLoading) {\n",
    "            setPendingDelete(null);\n",
    "          }\n",
    "        }}\n",
    "      />\n",
    "    </div>\n",
    "  );\n",
    "};\n",
    "\n",
    "export default PortfolioPage;\n",
]

# 找到 </section> 的行索引
section_idx = None
for i, line in enumerate(lines):
    if '</section>' in line:
        section_idx = i
        break

print(f"</section> 在索引 {section_idx} (行 {section_idx+1})")

# 保留 0 到 section_idx-1 的行（即 1836 行之前）
# 然后追加正确的结尾
new_lines = lines[:section_idx] + correct_ending

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"修复后: {len(new_lines)} 行")
print("最后20行:")
for i in range(max(0, len(new_lines)-20), len(new_lines)):
    print(f"  {i+1}: {new_lines[i].rstrip()}")
print('✅ 恢复完成！')
