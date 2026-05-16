#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Add ConfirmDialog and fix closing tags"""

file_path = 'apps/dsa-web/src/pages/PortfolioPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"当前: {len(lines)} 行")

# Find the line with "};\n" after </section>
for i in range(len(lines)-1, -1, -1):
    if lines[i].strip() == '};':
        # Insert ConfirmDialog before this line
        confirm_dialog = """
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
    </div>
  );
"""
        lines.insert(i, confirm_dialog)
        break

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"修复后: {len(lines)} 行")
print("最后25行:")
for i in range(max(0, len(lines)-25), len(lines)):
    print(f"  {i+1}: {lines[i].rstrip()}")
print('✅ 完成！')
