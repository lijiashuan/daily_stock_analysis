#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""恢复并修复 PortfolioPage.tsx"""

file_path = 'apps/dsa-web/src/pages/PortfolioPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"当前: {len(lines)} 行")

# 从 1842 行开始有问题，需要恢复 ConfirmDialog
# 找到 </section> 后的行
section_idx = None
for i, line in enumerate(lines):
    if '</section>' in line and section_idx is None:
        section_idx = i
        break

print(f"</section> 在索引 {section_idx} (行 {section_idx+1})")

# 在 </section> 后插入缺失的 ConfirmDialog
missing_part = """
      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="删除错误流水"
        message={pendingDelete?.message || '确认删除这条流水吗？'}
        confirmText={deleteLoading ? '删除中...' : '确认删除'}
        cancelText="取消"
        isDanger
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleteLoading) {
            setPendingDelete(null);
          }
        }}
      />
"""

# 在 </section> 行后插入
lines.insert(section_idx + 1, missing_part)

# 现在删除多余的行 (从 section_idx+2 开始到 </div> 前的那些)
# 找到 </div> 之前的内容
for i in range(section_idx + 2, len(lines)):
    if '</div>' in lines[i]:
        # 删除 section_idx+2 到 i-1 的所有行
        del lines[section_idx + 2:i]
        break

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"修复后: {len(lines)} 行")
print("最后20行:")
for i in range(max(0, len(lines)-20), len(lines)):
    print(f"  {i+1}: {lines[i].rstrip()}")
print('✅ 完成！')
