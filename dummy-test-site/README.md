# Perceptual Web — Dummy Test Site

Deliberately cluttered, inaccessible static HTML pages for hackathon development.

## Quick start

```bash
cd dummy-test-site
npm start
```

Open **http://localhost:8080**

## Pages

| Page | URL | Exercises |
|------|-----|-----------|
| **ShopClutter** | `/shop-clutter.html` | Visual, Cognitive, Motor, Vestibular, Essentialist — **primary demo** |
| **NewsWall** | `/news-wall.html` | Cognitive, Visual, Motor, Vestibular |
| **FormMaze** | `/form-maze.html` | Motor, Cognitive, Visual (forms) |

## Interactive elements (proxy finale targets)

### ShopClutter
- `#btn-add-to-cart` — shows inline cart confirmation
- `#nav-headphones` — real nav link (same page)
- `#nav-news` — navigates to NewsWall
- `#size-s`, `#size-m`, `#size-l`, `#size-xl` — size selection
- `#coupon-checkbox` — toggles final price

### NewsWall
- `#comment-form` / `#comment-submit` — form submit with inline confirmation
- `#nav-shop` — navigates to ShopClutter
- `#cookie-accept` — dismisses cookie banner

### FormMaze
- `#benefits-form` / `#form-submit` — full form submit with validation

All interactive elements use plain DOM events (no frameworks). Elements have `id` and `data-pw-role` attributes for easy extraction.

## Shared contracts

See `../shared/contracts.ts` for `ExtractedPage`, `ProxyMessage`, and agreed URLs.
