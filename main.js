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
    let jobPath = await job.get(AccessLevel.ReadOnly);
    let unit = await (await flowElement.getPropertyStringValue("unit")).toString();
    let decimals = parseInt(await (await flowElement.getPropertyStringValue("decimals")).toString());
    try {
        let pdf = PdfDocument.open(jobPath);
        let pdfProperties = {};
        pdfProperties.name = job.getName(true);
        pdfProperties.nbPages = pdf.getNumberOfPages();
        pdfProperties.version = pdf.getPDFVersion();
        pdfProperties.securityMethod = pdf.getSecurityMethod();
        let pdfPage = pdf.getPage(1);
        pdfProperties.pageBoxes = {};
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
        var xmlString = jsonxml_1.default(pdfProperties, xmlOptions);
        await job.log(LogLevel.Debug, "xmlString: %1", [xmlString]);
        // write xml
        await fs.writeFileSync(tmpFilePath, xmlString, 'utf-8');
        // create dataset
        let datasetName = await (await flowElement.getPropertyStringValue("datasetName")).toString();
        await job.createDataset(datasetName, tmpFilePath, DatasetModel.XML);
        await job.sendToSingle();
        // remove tmpFile
        await fs.unlinkSync(tmpFilePath);
    }
    catch (error) {
        await job.log(LogLevel.Error, error.message, []);
        await job.sendToSingle();
    }
}
function convert(unit, decimals, value) {
    if (unit == "Points") {
        return value;
    }
    else if (unit == "Millimeters") {
        let convertedValue = value / 72 * 25.4;
        let roundMultiplier = Math.pow(10, decimals);
        convertedValue = Math.round(convertedValue * roundMultiplier) / roundMultiplier;
        return convertedValue;
    }
    else {
        let convertedValue = value / 72;
        let roundMultiplier = Math.pow(10, decimals);
        convertedValue = Math.round(convertedValue * roundMultiplier) / roundMultiplier;
        return convertedValue;
    }
}
//# sourceMappingURL=main.js.map