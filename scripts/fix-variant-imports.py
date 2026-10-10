import os
import re

VARIANTS_DIR = 'packages/ui/src/components/ui/landing/variants'

for root, dirs, files in os.walk(VARIANTS_DIR):
    for f in files:
        if not f.endswith('.tsx') and not f.endswith('.ts'):
            continue
        p = os.path.join(root, f)
        with open(p, 'r', encoding='utf-8') as file:
            content = file.read()

        # Fix relative imports that broke due to being 2 levels deeper
        # 1. ../../../lib/utils -> ../../../../../lib/utils
        content = content.replace("from '../../../lib/utils'", "from '../../../../../lib/utils'")
        content = content.replace("from '../../../../lib/utils'", "from '../../../../../../lib/utils'")

        # 2. ../../lib/ -> ../../../../lib/
        content = content.replace("from '../../lib/", "from '../../../../lib/")

        # 3. ../tabs -> ../../../tabs
        content = content.replace("from '../tabs'", "from '../../../tabs'")

        # 4. ../../../hooks/use-intl-locale -> ../../../../../hooks/use-intl-locale
        content = content.replace("from '../../../hooks/use-intl-locale'", "from '../../../../../hooks/use-intl-locale'")

        # 5. ../navigation/ -> ../../../navigation/
        content = content.replace("from '../navigation/", "from '../../../navigation/")
        content = content.replace("from './navigation/", "from '../../navigation/")

        # 6. ./use-scene-observer -> ../../use-scene-observer
        content = content.replace("from './use-scene-observer'", "from '../../use-scene-observer'")
        content = content.replace("from './use-scroll-narrative-store'", "from '../../use-scroll-narrative-store'")
        content = content.replace("from './landing-shell'", "from '../../landing-shell'")
        content = content.replace("from './landing-primitives'", "from '../../landing-primitives'")

        # 7. fix product-scene / offline-scene props
        if f == 'product-scene.tsx':
            content = re.sub(r'export function ProductScene\(\{.*\}\: \{.*\}\)',
                             'export function ProductScene({ copy }: { copy: any })', content)
        if f == 'offline-scene.tsx':
            content = re.sub(r'export function OfflineScene\(\{.*\}\: \{.*\}\)',
                             'export function OfflineScene({ copy }: { copy: any })', content)

        with open(p, 'w', encoding='utf-8') as file:
            file.write(content)

print("Fixed imports in variants!")
