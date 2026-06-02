# Markdown Feature Preview

Welcome to the enhanced **Open File Viewer** Markdown renderer! 

This file demonstrates various formatted elements rendered dynamically in the browser container.

## 1. Typography & Inline Styles

You can write text with *italic*, **bold**, `inline code`, or ~~strikethrough~~ styles.

Here is a blockquote for key details:
> "Design should wow the user at first glance. Elegant layouts, responsive designs, and smooth transitions create a premium experience."

---

## 2. Lists

### Unordered List
* Modern design aesthetics
* Flexible framework adapters
  * React
  * Vue
* Lightweight core plugin system

### Ordered List
1. Load container settings
2. Determine matched file format plugin
3. Render content dynamically

---

## 3. Code Blocks

Here is a TypeScript code block highlighted dynamically using **Prism.js**:

```typescript
import { createViewer } from "@open-file-viewer/core";

const viewer = createViewer({
  container: "#viewer-container",
  file: myFile,
  theme: "auto",
  toolbar: true
});
```

And a Python example:

```python
def calculate_area(width, height):
    # Calculate geometric area
    return width * height

print(f"Area: {calculate_area(10, 20)}")
```

---

## 4. Tables

| Feature | Supported | Technology |
| :--- | :---: | :--- |
| GeoJSON / KML Map | ✅ | Leaflet |
| Markdown Layout | ✅ | Marked.js |
| Code Highlighting | ✅ | Prism.js |
| Video Formats | ✅ | Hls.js & Mpegts.js |
