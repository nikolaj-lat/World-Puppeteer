---
name: image-gen
description: Explicit-only image generation workflow for approved bitmap assets. Use only when the user asks to generate, vary, upload, or attach images.
---

# Image Generation

This skill is explicit-only. It may use external services and create image files.

## Workflow

1. Resolve the target world and active art/profile rules.
2. Confirm the image subject, output purpose, storage path, and whether upload is approved.
3. Build prompts only from approved source fields or explicit user direction.
4. Keep world art direction in world profiles, not generic instructions.
5. Save generated files under an approved world-relative output path.
6. Upload only after explicit approval.

## Boundaries

Do not edit NPC/world content to fit an image prompt unless that content edit is separately approved. Do not hardcode franchise, studio, or cultural art direction in this generic skill.
