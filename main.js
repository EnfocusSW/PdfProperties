"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const tmp = __importStar(require("tmp"));
const jsonxml_1 = __importDefault(require("jsonxml"));
async function jobArrived(s, flowElement, job) {
    if (job.getName(true).endsWith(".pdf") == false) {
        await job.log(LogLevel.Error, "Job is not a pdf, job sent to the error connection", []);
        await job.sendToData(Connection.Level.Error);
    }
    else {
        let jobPath = await job.get(AccessLevel.ReadOnly);
        let unit = await (await flowElement.getPropertyStringValue("unit")).toString();
        let decimals = parseInt(await (await flowElement.getPropertyStringValue("decimals")).toString());
        let pdfDoc;
        try {
            // open PDF file
            pdfDoc = PdfDocument.open(jobPath);
            // create new empty object
            let pdfProperties = {};
            pdfProperties.name = job.getName(true);
            pdfProperties.nbPages = pdfDoc.getNumberOfPages();
            pdfProperties.version = pdfDoc.getPDFVersion();
            pdfProperties.securityMethod = pdfDoc.getSecurityMethod();
            // get page boxes for the first page
            let pdfPage = pdfDoc.getPage(1);
            pdfProperties.scalingFactor = pdfPage.getScaling();
            pdfProperties.rotation = pdfPage.getRotation();
            pdfProperties.pageBoxes = {};
            pdfProperties.pageBoxes.unit = unit;
            pdfProperties.pageBoxes.pageBoxesEqual = true;
            pdfProperties.pageBoxes.pageBoxesDifferentFromPage = "";
            pdfProperties.pageBoxes.mediaBoxWidth = convert(unit, decimals, pdfPage.getMediaBoxWidth(false));
            pdfProperties.pageBoxes.mediaBoxHeight = convert(unit, decimals, pdfPage.getMediaBoxHeight(false));
            pdfProperties.pageBoxes.trimBoxWidth = convert(unit, decimals, pdfPage.getTrimBoxWidth(false));
            pdfProperties.pageBoxes.trimBoxHeight = convert(unit, decimals, pdfPage.getTrimBoxHeight(false));
            pdfProperties.pageBoxes.cropBoxWidth = convert(unit, decimals, pdfPage.getCropBoxWidth(false));
            pdfProperties.pageBoxes.cropBoxHeight = convert(unit, decimals, pdfPage.getCropBoxHeight(false));
            pdfProperties.pageBoxes.bleedBoxWidth = convert(unit, decimals, pdfPage.getBleedBoxWidth(false));
            pdfProperties.pageBoxes.bleedBoxHeight = convert(unit, decimals, pdfPage.getBleedBoxHeight(false));
            pdfProperties.pageBoxes.artBoxWidth = convert(unit, decimals, pdfPage.getArtBoxWidth(false));
            pdfProperties.pageBoxes.artBoxHeight = convert(unit, decimals, pdfPage.getArtBoxHeight(false));
            // go over all the pages and compare page boxes
            if (pdfProperties.nbPages > 1) {
                for (let p = 2; p <= pdfProperties.nbPages; p++) {
                    pdfPage = pdfDoc.getPage(p);
                    if (convert(unit, decimals, pdfPage.getMediaBoxWidth()) != pdfProperties.pageBoxes.mediaBoxWidth || convert(unit, decimals, pdfPage.getMediaBoxHeight()) != pdfProperties.pageBoxes.mediaBoxHeight) {
                        pdfProperties.pageBoxes.pageBoxesEqual = false;
                        await job.log(LogLevel.Error, "Different media box detected on page %1", [p]);
                    }
                    if (convert(unit, decimals, pdfPage.getTrimBoxWidth()) != pdfProperties.pageBoxes.trimBoxWidth || convert(unit, decimals, pdfPage.getTrimBoxHeight()) != pdfProperties.pageBoxes.trimBoxHeight) {
                        pdfProperties.pageBoxes.pageBoxesEqual = false;
                        await job.log(LogLevel.Error, "Different trim box detected on page %1", [p]);
                    }
                    if (convert(unit, decimals, pdfPage.getCropBoxWidth()) != pdfProperties.pageBoxes.cropBoxWidth || convert(unit, decimals, pdfPage.getCropBoxHeight()) != pdfProperties.pageBoxes.cropBoxHeight) {
                        pdfProperties.pageBoxes.pageBoxesEqual = false;
                        await job.log(LogLevel.Error, "Different crop box detected on page %1", [p]);
                    }
                    if (convert(unit, decimals, pdfPage.getBleedBoxWidth()) != pdfProperties.pageBoxes.bleedBoxWidth || convert(unit, decimals, pdfPage.getBleedBoxHeight()) != pdfProperties.pageBoxes.bleedBoxHeight) {
                        pdfProperties.pageBoxes.pageBoxesEqual = false;
                        await job.log(LogLevel.Error, "Different bleed box detected on page %1", [p]);
                    }
                    if (convert(unit, decimals, pdfPage.getArtBoxWidth()) != pdfProperties.pageBoxes.artBoxWidth || convert(unit, decimals, pdfPage.getArtBoxHeight()) != pdfProperties.pageBoxes.artBoxHeight) {
                        pdfProperties.pageBoxes.pageBoxesEqual = false;
                        await job.log(LogLevel.Error, "Different art box detected on page %1", [p]);
                    }
                    if (pdfProperties.pageBoxes.pageBoxesEqual == false) {
                        pdfProperties.pageBoxes.pageBoxesDifferentFromPage = p;
                        break;
                    }
                }
            }
            // get page labels
            let pageLabels = [];
            for (let p = 1; p <= pdfProperties.nbPages; p++) {
                pdfPage = pdfDoc.getPage(p);
                if (pdfPage.getPageLabel() != "") {
                    pageLabels.push(pdfPage.getPageLabel());
                }
                else {
                    pageLabels.push("none");
                }
            }
            pdfProperties.pageLabels = pageLabels.join(", ");
            // close the PDF document
            pdfDoc.close();
            pdfDoc = null;
            // create temp file
            let tmpFilePath = tmp.fileSync().name;
            await job.log(LogLevel.Debug, "tmp file path: %1", [tmpFilePath]);
            // json object to xml
            let xmlOptions = { header: true, root: "PdfProperties", indent: true };
            var xmlString = jsonxml_1.default(pdfProperties, xmlOptions);
            await job.log(LogLevel.Debug, "xmlString: %1", [xmlString]);
            // write xml
            await fs.writeFileSync(tmpFilePath, xmlString, 'utf-8');
            // create dataset
            let datasetName = await (await flowElement.getPropertyStringValue("datasetName")).toString();
            await job.createDataset(datasetName, tmpFilePath, DatasetModel.XML);
            // send job to right traffic light connection
            if (pdfProperties.pageBoxes.pageBoxesEqual == true) {
                await job.sendToData(Connection.Level.Success);
            }
            else {
                await job.sendToData(Connection.Level.Error);
            }
            // remove tmpFile
            await fs.unlinkSync(tmpFilePath);
        }
        catch (error) {
            job.fail('PDF error: %1', [error.message]);
            if (pdfDoc) {
                pdfDoc.close();
            }
        }
    }
}
function convert(unit, decimals, value) {
    let roundMultiplier = Math.pow(10, decimals);
    if (unit == "Points") {
        return Math.round(value * roundMultiplier) / roundMultiplier;
    }
    else if (unit == "Millimeters") {
        return Math.round(value / 72 * 25.4 * roundMultiplier) / roundMultiplier;
    }
    else { // Inches
        return Math.round(value / 72 * roundMultiplier) / roundMultiplier;
    }
}
//# sourceMappingURL=main.js.map