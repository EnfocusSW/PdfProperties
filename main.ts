import * as fs from "fs";
import * as tmp from "tmp";
import jsonxml from "jsonxml";

async function jobArrived(s: Switch, flowElement: FlowElement, job: Job) {
    let jobPath = await job.get(AccessLevel.ReadOnly);
    let unit = await (await flowElement.getPropertyStringValue("unit")).toString();
    let decimals = parseInt(await (await flowElement.getPropertyStringValue("decimals")).toString());

    try {
        let pdf = PdfDocument.open(jobPath);
        let pdfProperties: Record<string, any> = {};
        pdfProperties.name = job.getName(true);
        pdfProperties.nbPages = pdf.getNumberOfPages();
        pdfProperties.version = pdf.getPDFVersion();
        pdfProperties.securityMethod = pdf.getSecurityMethod();

        let pdfPage = pdf.getPage(1);
        pdfProperties.pageBoxes = {}
        pdfProperties.pageBoxes.unit = unit;
        pdfProperties.pageBoxes.pageBoxesEqual = true;
        pdfProperties.pageBoxes.pageBoxesDifferentFromPage = "";
        pdfProperties.pageBoxes.mediaBoxWidth = convert(unit, decimals, pdfPage.getMediaBoxWidth());
        pdfProperties.pageBoxes.mediaBoxHeight = convert(unit, decimals, pdfPage.getMediaBoxHeight());
        pdfProperties.pageBoxes.trimBoxWidth = convert(unit, decimals, pdfPage.getTrimBoxWidth());
        pdfProperties.pageBoxes.trimBoxHeight = convert(unit, decimals, pdfPage.getTrimBoxHeight());
        pdfProperties.pageBoxes.cropBoxWidth = convert(unit, decimals, pdfPage.getCropBoxWidth());
        pdfProperties.pageBoxes.cropBoxHeight = convert(unit, decimals, pdfPage.getCropBoxHeight());
        pdfProperties.pageBoxes.bleedBoxWidth = convert(unit, decimals, pdfPage.getBleedBoxWidth());
        pdfProperties.pageBoxes.bleedBoxHeight = convert(unit, decimals, pdfPage.getBleedBoxHeight());
        pdfProperties.pageBoxes.artBoxWidth = convert(unit, decimals, pdfPage.getArtBoxWidth());
        pdfProperties.pageBoxes.artBoxHeight = convert(unit, decimals, pdfPage.getArtBoxHeight());
        if (pdfProperties.nbPages > 1) {
            for (let p = 2; p <= pdfProperties.nbPages; p++) {
                pdfPage = pdf.getPage(p);
                if (convert(unit, decimals, pdfPage.getMediaBoxWidth()) != pdfProperties.pageBoxes.mediaBoxWidth || convert(unit, decimals, pdfPage.getMediaBoxHeight()) != pdfProperties.pageBoxes.mediaBoxHeight) {
                    pdfProperties.pageBoxes.pageBoxesEqual = false;
                    await job.log(LogLevel.Warning, "Different media box detected on page %1", [p]);
                }
                if (convert(unit, decimals, pdfPage.getTrimBoxWidth()) != pdfProperties.pageBoxes.trimBoxWidth || convert(unit, decimals, pdfPage.getTrimBoxHeight()) != pdfProperties.pageBoxes.trimBoxHeight) {
                    pdfProperties.pageBoxes.pageBoxesEqual = false;
                    await job.log(LogLevel.Warning, "Different trim box detected on page %1", [p]);
                }
                if (convert(unit, decimals, pdfPage.getCropBoxWidth()) != pdfProperties.pageBoxes.cropBoxWidth || convert(unit, decimals, pdfPage.getCropBoxHeight()) != pdfProperties.pageBoxes.cropBoxHeight) {
                    pdfProperties.pageBoxes.pageBoxesEqual = false;
                    await job.log(LogLevel.Warning, "Different crop box detected on page %1", [p]);
                }
                if (convert(unit, decimals, pdfPage.getBleedBoxWidth()) != pdfProperties.pageBoxes.bleedBoxWidth || convert(unit, decimals, pdfPage.getBleedBoxHeight()) != pdfProperties.pageBoxes.bleedBoxHeight) {
                    pdfProperties.pageBoxes.pageBoxesEqual = false;
                    await job.log(LogLevel.Warning, "Different bleed box detected on page %1", [p]);
                }
                if (convert(unit, decimals, pdfPage.getArtBoxWidth()) != pdfProperties.pageBoxes.artBoxWidth || convert(unit, decimals, pdfPage.getArtBoxHeight()) != pdfProperties.pageBoxes.artBoxHeight) {
                    pdfProperties.pageBoxes.pageBoxesEqual = false;
                    await job.log(LogLevel.Warning, "Different art box detected on page %1", [p]);
                }
                if (pdfProperties.pageBoxes.pageBoxesEqual == false) {
                    pdfProperties.pageBoxes.pageBoxesDifferentFromPage = p;
                    break;
                }
            }
        }
        pdf.close();

        //create temp file
        let tmpFilePath = tmp.fileSync().name;
        await job.log(LogLevel.Debug, "tmp file path: %1", [tmpFilePath]);

        // json object to xml
        let xmlOptions = { header: true, root: "PdfProperties", indent: true };
        var xmlString = jsonxml(pdfProperties, xmlOptions);
        await job.log(LogLevel.Debug, "xmlString: %1", [xmlString]);

        // write xml
        await fs.writeFileSync(tmpFilePath, xmlString, 'utf-8');

        // create dataset
        let datasetName = await (await flowElement.getPropertyStringValue("datasetName")).toString();
        await job.createDataset(datasetName, tmpFilePath, DatasetModel.XML);

        await job.sendToSingle();

        // remove tmpFile
        await fs.unlinkSync(tmpFilePath);

    } catch (error) {
        await job.log(LogLevel.Error, error.message, []);
        await job.sendToSingle();
    }
}

function convert(unit: string, decimals: number, value: number) {
    let roundMultiplier = Math.pow(10, decimals);
    if (unit == "Points") {
        return Math.round(value * roundMultiplier) / roundMultiplier;
    } else if (unit == "Millimeters") {
        return Math.round(value / 72 * 25.4 * roundMultiplier) / roundMultiplier;
    } else { // Inches
        return Math.round(value / 72 * roundMultiplier) / roundMultiplier;
    }
}