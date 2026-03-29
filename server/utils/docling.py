from docling.document_converter import DocumentConverter, PdfFormatOption, InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, EasyOcrOptions
from docling_core.types.doc import ImageRefMode
from pathlib import Path

def extract_markdown_from_pdf(formUrl: str) -> str:
    output_dir = Path("./output")
    output_dir.mkdir(parents=True, exist_ok=True)

    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_table_structure = True
    pipeline_options.do_ocr = True
    pipeline_options.ocr_options = EasyOcrOptions(
        force_full_page_ocr=False,
        lang=["en"]
    )
    pipeline_options.generate_picture_images = True

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )

    result = converter.convert(formUrl)
    doc = result.document

    # Save extracted images to disk with predictable filenames
    for pic in doc.pictures:
        if pic.image and pic.image.pil_image:
            img_filename = output_dir / f"{pic.self_ref.replace('/', '_')}.png"
            pic.image.pil_image.save(img_filename)
            # Point the reference to the saved file path
            pic.image.uri = img_filename

    # Export to markdown with file references instead of base64
    markdown_text = doc.export_to_markdown(image_mode=ImageRefMode.REFERENCED)

    return markdown_text
