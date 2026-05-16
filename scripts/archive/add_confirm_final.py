#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Add ConfirmDialog to PortfolioPage.tsx - FINAL VERSION"""

file_path = 'apps/dsa-web/src/pages/PortfolioPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check if ConfirmDialog already exists
if 'ConfirmDialog' in content:
    print('✅ ConfirmDialog already exists!')
else:
    # Find the position to insert (before the last "};\n")
    lines = content.split('\n')
    
    # Find the line with just "};"
    insert_idx = None
    for i in range(len(lines)-1, -1, -1):
        if lines[i].strip() == '};':
            insert_idx = i
            break
    
    if insert_idx is None:
        print('❌ Could not find insertion point')
        exit(1)
    
    # Insert ConfirmDialog before "};"
    confirm_dialog_lines = [
        '',
        '      <ConfirmDialog',
        '        isOpen={Boolean(pendingDelete)}',
        '        title="删除错误流水"',
        '        message={pendingDelete?.message || \'确认删除这条流水吗？\'}',
        '        confirmText={deleteLoading ? \'删除中...\' : \'确认删除\'}',
        '        cancelText="取消"',
        '        isDanger',
        '        onConfirm={() => void handleConfirmDelete()}',
        '        onCancel={() => {',
        '          if (!deleteLoading) {',
        '            setPendingDelete(null);',
        '          }',
        '        }}',
        '      />',
        '    </div>',
        '  );',
    ]
    
    # Insert at the found index
    for j, line in enumerate(confirm_dialog_lines):
        lines.insert(insert_idx + j, line)
    
    content = '\n'.join(lines)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f'✅ Added ConfirmDialog at line {insert_idx}')
    print(f'Total lines: {len(lines)}')
