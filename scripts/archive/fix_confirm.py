#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Fix PortfolioPage.tsx - restore ConfirmDialog"""

file_path = 'apps/dsa-web/src/pages/PortfolioPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the broken part and replace it
broken = """  </section>
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleteLoading) {
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
};

export default PortfolioPage;"""

fixed = """  </section>

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
};

export default PortfolioPage;"""

if broken in content:
    content = content.replace(broken, fixed)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('✅ Fixed!')
else:
    print('❌ Pattern not found, trying alternative...')
    # Try finding just the section end
    if '  </section>' in content and 'onConfirm={() => void handleConfirmDelete()}' in content:
        # The file structure is there but with wrong spacing
        # Find the index of </section>
        lines = content.split('\n')
        section_line = None
        for i, line in enumerate(lines):
            if '</section>' in line:
                section_line = i
                break
        
        if section_line is not None:
            # Everything from section_line onward needs to be replaced
            new_ending = """  </section>

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
};

export default PortfolioPage;"""
            lines = lines[:section_line] + new_ending.split('\n')
            content = '\n'.join(lines)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print('✅ Fixed with alternative method!')
        else:
            print('❌ Could not find </section>')
    else:
        print('❌ Could not identify the issue')
