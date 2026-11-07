PHOTOGRAPHS (included). Exact filenames, all .png, all 16:9, about 1672x941:

 hero-aerial.png         hero background (full screen)
 tractor-closeup.png     machinery scene 1
 harvester.png           machinery scene 2
 sprayer.png             machinery scene 3
 farmer.png              farmer section
 equipment-owner.png     equipment owner section
 closing-landscape.png   closing section

To swap a photo, replace the file with the SAME NAME. No code changes are needed.
A missing or failed file never breaks the layout: that slot shows a dark forest-green placeholder
(farmer and owner slots keep their illustration).

CROP POSITIONS live in index.html as CSS variables on each slot, for example:
  style="--pos-d:100% 50%;--pos-m:75% 50%"
  --pos-d = object-position on desktop, --pos-m = on screens 900px wide and below.
They were computed from the actual subject positions in these photographs. If you replace a photo
with a different composition, adjust these two values (x% y%).

FILE SIZE: each PNG is 2.2 to 2.8 MB (17 MB in total). Only the hero loads immediately; the rest load lazily.
For production, compress them losslessly or to a visually identical quality (keeping the same filenames).
