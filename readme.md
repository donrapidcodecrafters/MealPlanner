# Family Meal Planner Binder App (28 Days)

This is a local-first browser app that generates a **binder-style 28-day family meal plan** matching the layout you shared:
- Title page
- Week divider pages
- Weekly grocery list page per week
- Sunday prep pages (batch cooking + snack prep)
- Daily meal page (Meals and Alternatives + Portion Sizes by Person)
- Daily grocery checklist page

## Run
1. Copy this folder to your device.
2. Open `index.html` in a modern browser.
3. Fill family setup and people.
4. Click **Generate 28-Day Binder**.
5. Click **Print / Save PDF** to export.

## GitHub Pages
This repo includes a GitHub Pages workflow at `.github/workflows/pages.yml`.

To publish it:
1. Create a GitHub repo for this project and push the `main` branch.
2. In GitHub, open `Settings` -> `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push to `main` or run the `Deploy GitHub Pages` workflow manually.

Published URL pattern:
- `https://<your-github-user>.github.io/<repo-name>/`

## Notes
- Output uses names only and omits personal goal/weight text.
- Setup is persisted in localStorage.
- The page layout is designed for clean printing to PDF.
