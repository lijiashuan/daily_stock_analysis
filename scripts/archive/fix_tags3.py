#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""修复 PortfolioPage.tsx 中的多余闭合标签 - 版本3"""

file_path = 'apps/dsa-web/src/pages/PortfolioPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 找到问题区域，用正确的闭合替换
old_text = """            </div>
              </div>
            </div>
              </div>
            </div>
              </div>
            </div>
              </div>
            </div>
            </div>
            </div>
          </div>
        </Card>
      </section>"""

new_text = """            </div>
          </div>
        </div>
          </div>
        </Card>
      </section>"""

if old_text in content:
    content = content.replace(old_text, new_text)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('✅ 修复完成！')
else:
    print('❌ 未找到需要替换的文本，请手动检查')
