import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export async function imprimirHtml(html: string): Promise<void> {
  await Print.printAsync({ html });
}

export async function compartirHtmlPdf(html: string, nombre = 'documento-argo'): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    await Print.printAsync({ html });
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: nombre,
    UTI: 'com.adobe.pdf',
  });
}
