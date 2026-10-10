import os
import shutil

VARIANTS = [
    '01-cinematic-operating-system',
    '02-editorial-ledger',
    '03-industrial-control-room',
    '04-living-business-map',
    '05-premium-financial-instrument',
    '06-digital-workshop',
    '07-swiss-business-system',
    '08-quiet-future',
    '09-business-story-film',
    '10-unexpected-hisabche'
]

SCENES = [
    'business-flow-scene.tsx',
    'chapter-scene.tsx',
    'chapter-visuals.tsx',
    'cinematic-hero.tsx',
    'compare-scene.tsx',
    'cta-scene.tsx',
    'faq-scene.tsx',
    'landing-primitives.tsx',
    'modules-scene.tsx',
    'offline-sync-scene.tsx',
    'pricing-scene.tsx',
    'security-scene.tsx',
    'site-footer-view.tsx',
    'system-scene.tsx',
    'transform-scene.tsx',
    'trust-bar-scene.tsx'
]

LANDING_DIR = 'packages/ui/src/components/ui/landing'
VARIANTS_DIR = os.path.join(LANDING_DIR, 'variants')

for v in VARIANTS:
    v_dir = os.path.join(VARIANTS_DIR, v)
    os.makedirs(v_dir, exist_ok=True)

    # Copy all scenes
    for scene in SCENES:
        src = os.path.join(LANDING_DIR, scene)
        dst = os.path.join(v_dir, scene)
        if not os.path.exists(dst):
            shutil.copy2(src, dst)

    # Copy landing-page.tsx to index.tsx if index.tsx doesn't exist
    index_dst = os.path.join(v_dir, 'index.tsx')
    if not os.path.exists(index_dst):
        shutil.copy2(os.path.join(LANDING_DIR, 'landing-page.tsx'), index_dst)

    print(f"Populated {v}")
