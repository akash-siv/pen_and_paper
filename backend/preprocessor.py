#!/usr/bin/env python3
"""
preprocessor.py
Simplified PDF page preprocessor for handwriting OCR.

Usage:
    python preprocessor.py input.pdf out_dir --dpi 300

#     best result : python preprocessor.py "Adobe_Scan.pdf" out_dir2 --dpi300 --clahe-clip 0
"""
import os
import argparse
from pdf2image import convert_from_path
import numpy as np
import cv2
from PIL import Image


# ------------------ utility conversions ------------------
def pil_to_cv2(pil):
    arr = np.array(pil)
    if arr.ndim == 2:
        return arr
    # PIL gives RGB
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def cv2_to_pil(img):
    if img.ndim == 2:
        return Image.fromarray(img)
    return Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))


# ------------------ simplified processing (from your Colab steps) ------------------
def simple_preprocess_page(pil_page,
                           denoise_h=10,
                           erosion_kernel=(2, 2),
                           adaptive_block=31,
                           adaptive_c=20,
                           close_kernel=(3, 3),
                           clahe_clip=0,
                           clahe_grid=(8, 8),
                           remove_lines=False,
                           line_kernel_factor=30,
                           inpaint_radius=3,
                           save_steps=False):
    """
    Perform:
      grayscale -> normalize -> denoise -> (optional CLAHE) ->
      (optional line detection & inpaint) -> erosion ->
      adaptive threshold -> close

    - remove_lines: if True, detect horizontal ruled lines and inpaint them (uses morphological open on a binary inverse).
    - line_kernel_factor: determines horizontal kernel length = img_width // line_kernel_factor (tuneable).
    - inpaint_radius: radius passed to cv2.inpaint when filling removed lines.

    Returns a dict with intermediate results (all as uint8 numpy arrays).
    """
    img = pil_to_cv2(pil_page)
    # grayscale
    if img.ndim == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()

    # normalize to full 0-255 range
    norm = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    norm = norm.astype(np.uint8)

    # denoise (fastNlMeansDenoising)
    denoised = cv2.fastNlMeansDenoising(norm, None, h=denoise_h)

    # optional contrast enhancement using CLAHE (local contrast)
    if clahe_clip is not None and clahe_clip > 0:
        tgx, tgy = clahe_grid if isinstance(clahe_grid, (list, tuple)) and len(clahe_grid) == 2 else (8, 8)
        clahe = cv2.createCLAHE(clipLimit=float(clahe_clip), tileGridSize=(int(tgx), int(tgy)))
        contrast = clahe.apply(denoised)
    else:
        contrast = denoised.copy()

    # ---------- optional line detection + inpaint ----------
    line_mask = None
    inpainted = contrast.copy()
    if remove_lines:
        # create a temporary binary inverted image where strokes (text & lines) are white
        # Use a slightly more global adaptive method for stable line detection
        tmp_block = adaptive_block if adaptive_block % 2 == 1 and adaptive_block > 1 else 31
        binary_inv = cv2.adaptiveThreshold(contrast, 255,
                                           cv2.ADAPTIVE_THRESH_MEAN_C,
                                           cv2.THRESH_BINARY_INV,
                                           blockSize=tmp_block,
                                           C=adaptive_c)

        # build a horizontal kernel whose length scales with image width
        h, w = binary_inv.shape
        kernel_len = max(3, w // int(max(1, line_kernel_factor)))
        horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_len, 1))

        # morphological open to keep only long horizontal components (i.e. ruled lines)
        detected_horiz = cv2.morphologyEx(binary_inv, cv2.MORPH_OPEN, horiz_kernel, iterations=1)

        # Optionally dilate the detected lines a tiny bit so we cover line thickness
        detected_horiz = cv2.dilate(detected_horiz, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=1)

        # line_mask must be single-channel non-zero where lines exist (for inpaint)
        line_mask = detected_horiz.copy()

        # inpaint the contrast image to remove lines but preserve surrounding handwriting
        # inpaint expects mask with non-zero pixels = area to inpaint
        # ensure mask is 8-bit single channel
        if np.max(line_mask) > 0:
            inpainted = cv2.inpaint(contrast, line_mask, inpaintRadius=inpaint_radius, flags=cv2.INPAINT_TELEA)
        else:
            # nothing detected, keep original contrast
            inpainted = contrast.copy()

    # thinning via erosion
    k_erode = cv2.getStructuringElement(cv2.MORPH_RECT, erosion_kernel)
    eroded = cv2.erode(inpainted, k_erode, iterations=1)

    # ensure block size is odd and >1
    if adaptive_block % 2 == 0:
        adaptive_block += 1
    if adaptive_block <= 1:
        adaptive_block = 3

    # adaptive binarization (final)
    binary = cv2.adaptiveThreshold(eroded, 255,
                                   cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY,
                                   blockSize=adaptive_block,
                                   C=adaptive_c)

    # morphological closing to fill small holes
    k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, close_kernel)
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, k_close, iterations=1)

    results = {
        'gray': gray.astype(np.uint8),
        'normalized': norm,
        'denoised': denoised,
        'contrast': contrast,
        'inpainted': inpainted,
        'line_mask': line_mask if line_mask is not None else np.zeros_like(contrast),
        'eroded': eroded,
        'binary': binary,
        'closed': closed
    }

    if not save_steps:
        return {'gray': results['gray'], 'binary': results['closed']}

    return results


# ------------------ main runner ------------------
def pdf_to_images_and_preprocess(pdf_path, out_dir, dpi=300, **kwargs):
    os.makedirs(out_dir, exist_ok=True)
    pages = convert_from_path(pdf_path, dpi=dpi)
    out_files = []
    for i, pil_page in enumerate(pages, start=1):
        print(f"[+] Processing page {i}/{len(pages)}")
        res = simple_preprocess_page(pil_page, **kwargs)

        # save final binary
        bin_pil = cv2_to_pil(res['binary'])
        bin_path = os.path.join(out_dir, f"page_{i:03d}_binary.png")
        bin_pil.save(bin_path)
        out_files.append(bin_path)

        # if user requested saving intermediate steps, save them too
        if kwargs.get('save_steps'):
            for name in ('denoised', 'contrast', 'inpainted', 'line_mask', 'eroded'):
                if name in res:
                    p = os.path.join(out_dir, f"page_{i:03d}_{name}.png")
                    # ensure correct type for line_mask which might be None
                    cv2.imwrite(p, res[name])
                    out_files.append(p)

    return out_files


# ------------------ CLI ------------------
def main():
    parser = argparse.ArgumentParser(description="Simplified preprocessing for handwriting OCR.")
    parser.add_argument("pdf", help="input PDF file")
    parser.add_argument("out_dir", help="output directory for images")
    # parser.add_argument("--dpi", type=int, default=300)
    # parser.add_argument("--denoise-h", type=float, default=10.0, help="h parameter for NLMeans denoising")
    # parser.add_argument("--erosion-k", type=int, nargs=2, default=[2, 2], help="erosion kernel size (w h)")
    # parser.add_argument("--adaptive-block", type=int, default=31, help="block size for adaptive threshold (odd)")
    # parser.add_argument("--adaptive-c", type=int, default=20, help="C constant for adaptive threshold")
    # parser.add_argument("--close-k", type=int, nargs=2, default=[3, 3], help="closing kernel size (w h)")
    # parser.add_argument("--save-steps", action="store_true",
    #                     help="save intermediate steps (normalized, denoised, eroded)")
    # # CLAHE / contrast options
    # parser.add_argument("--clahe-clip", type=float, default=2.0,
    #                     help="CLAHE clipLimit (>0 to enable, 0 to disable). Larger -> stronger local contrast.")
    # parser.add_argument("--clahe-tiles", type=int, nargs=2, default=[8, 8],
    #                     help="CLAHE tileGridSize (w h)")
    # # Line removal options
    # parser.add_argument("--remove-lines", action="store_true", help="detect and remove ruled horizontal lines")
    # parser.add_argument("--line-kernel-factor", type=int, default=50,
    #                     help="kernel length = image_width // line_kernel_factor (smaller -> longer kernel)")
    # parser.add_argument("--inpaint-radius", type=int, default=3, help="radius for cv2.inpaint")

    args = parser.parse_args()

    files = pdf_to_images_and_preprocess(
        args.pdf,
        args.out_dir,
        # dpi=args.dpi,
        # denoise_h=args.denoise_h,
        # erosion_kernel=tuple(args.erosion_k),
        # adaptive_block=args.adaptive_block,
        # adaptive_c=args.adaptive_c,
        # close_kernel=tuple(args.close_k),
        # clahe_clip=args.clahe_clip,
        # clahe_grid=tuple(args.clahe_tiles),
        # remove_lines=args.remove_lines,
        # line_kernel_factor=args.line_kernel_factor,
        # inpaint_radius=args.inpaint_radius,
        # save_steps=args.save_steps
    )
    print("[+] Saved files:")
    for f in files:
        print("   ", f)


if __name__ == "__main__":
    main()
