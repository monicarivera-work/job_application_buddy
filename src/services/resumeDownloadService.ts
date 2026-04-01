import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle,
} from 'docx';
import PDFDocument from 'pdfkit';
import { ParsedResume, ResumeSectionStyle } from '../domain/resume';

function alignmentFor(style?: ResumeSectionStyle): (typeof AlignmentType)[keyof typeof AlignmentType] {
  if (style?.textAlign === 'center') return AlignmentType.CENTER;
  if (style?.textAlign === 'right')  return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

/**
 * Generates a .docx Buffer from the parsed resume.
 */
export async function generateDocx(resume: ParsedResume): Promise<Buffer> {
  const sorted = [...resume.sections].sort((a, b) => a.order - b.order);

  const children: Paragraph[] = [];
  for (const section of sorted) {
    // Section heading
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_2,
        alignment: alignmentFor(section.style),
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2b6cb0' } },
        spacing: { before: 200, after: 100 },
      }),
    );

    // Section body – split by newlines to get paragraphs
    const bodyLines = section.content.split('\n');
    for (const line of bodyLines) {
      children.push(
        new Paragraph({
          alignment: alignmentFor(section.style),
          children: [
            new TextRun({
              text: line,
              font: section.style?.fontFamily ?? 'Calibri',
              size: (section.style?.fontSize ?? 11) * 2, // half-points
              bold: section.style?.bold,
              italics: section.style?.italic,
              color: section.style?.color?.replace('#', '') ?? '2d3748',
            }),
          ],
          spacing: { after: 80 },
        }),
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}

/**
 * Generates a PDF Buffer from the parsed resume.
 */
export function generatePdf(resume: ParsedResume): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const sorted = [...resume.sections].sort((a, b) => a.order - b.order);

      for (const section of sorted) {
        const style = section.style;
        const align: 'left' | 'center' | 'right' = style?.textAlign ?? 'left';
        const fontSz = style?.fontSize ?? 11;

        // Heading
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor(style?.color ?? '#2b6cb0')
          .text(section.title, { align })
          .moveDown(0.2);
        doc
          .moveTo(50, doc.y)
          .lineTo(doc.page.width - 50, doc.y)
          .stroke('#2b6cb0')
          .moveDown(0.3);

        // Body
        doc
          .fontSize(fontSz)
          .font(style?.italic ? 'Helvetica-Oblique' : 'Helvetica')
          .fillColor(style?.color ?? '#2d3748')
          .text(section.content, { align })
          .moveDown(0.8);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
