# BTTP V2 Website

A responsive, Vercel-ready landing page for Back to the Points.

## Files
- `index.html` - complete page
- `styles.css` - responsive visual system
- `script.js` - animation, mobile navigation, waitlist UI
- `vercel.json` - Vercel static deployment config

## Deploy to Vercel
1. Unzip this folder.
2. Create a new GitHub repository and upload these files, or drag the folder into your existing local project.
3. In Vercel, choose **Add New → Project** and import the repository.
4. Framework preset: **Other**.
5. No build command is required.
6. Deploy.

## Important: waitlist form
The front-end form validates and displays a confirmation state, but it deliberately does **not** persist emails yet.

Connect it to one of:
- your existing BTTP backend/API
- Supabase
- Firebase
- Google Sheets via a server-side endpoint
- Resend / Loops / Mailchimp / ConvertKit
- Vercel Functions + your preferred database

Do not expose database secrets in `script.js`.

## Production checks before launch
- Replace security copy with claims that exactly match your implemented data architecture.
- Add Privacy Policy and Terms pages.
- Wire analytics.
- Wire waitlist persistence.
- Replace typographic institution/program marks with approved logo assets where permitted.
- Add Open Graph/social preview image.
