import fs from "fs";
import { access, readFile } from "fs/promises";
import path from "path";
import fse from "fs-extra";
import dotenv from "dotenv";
import FormData from "form-data";
import fetch from "node-fetch";

dotenv.config();

const DIR_IN = process.env.DIR_IN!;
const FENNOA_USER = process.env.FENNOA_USER!;
const FENNOA_PASS = process.env.FENNOA_PASS!;

const fennoaBaseUrl = `https://app.fennoa.com/api`;
const fennoaHeaders = new Headers();

fennoaHeaders.set(
  "Authorization",
  "Basic " + Buffer.from(FENNOA_USER + ":" + FENNOA_PASS).toString("base64")
);

const getFiles = async (dir: string, ext: string): Promise<string[]> =>
  fs.readdirSync(dir).filter((file) => file.endsWith(ext));

const postPurchaseOrderToFennoa = async (
  jsonData: any
): Promise<boolean | string> => {
  const formData = new FormData();
  // Required fields
  if (!jsonData.seller.name) throw new Error("Supplier name is required");
  formData.append("supplier_name", jsonData.seller.name);

  if (!jsonData.invoiceDate) throw new Error("Invoice date is required");
  formData.append("invoice_date", jsonData.invoiceDate);

  if (!jsonData.dueDate) throw new Error("Due date is required");
  formData.append("due_date", jsonData.dueDate);

  if (!jsonData.paymentInfo.iban) throw new Error("Bank account is required");
  formData.append("bank_account", jsonData.paymentInfo.iban);

  if (!jsonData.paymentInfo.swiftBic)
    throw new Error("Bank BIC/SWIFT code is required");
  formData.append("bank_bic", jsonData.paymentInfo.swiftBic);
  if (jsonData.paymentInfo.referenceNumber) {
    const referenceNumber = jsonData.paymentInfo.referenceNumber.replace(
      /\s+/g,
      ""
    );
    formData.append("bank_reference", referenceNumber);
  } else formData.append("bank_message", jsonData.invoiceNumber);

  if (!jsonData.totalAmountWithVAT) throw new Error("Total gross is required");
  formData.append("total_gross", jsonData.totalAmountWithVAT);

  // Optional fields
  if (jsonData.seller.ID)
    formData.append("purchase_supplier_id", jsonData.seller.ID);
  if (jsonData.seller.VATNumber)
    formData.append("supplier_business_id", jsonData.seller.VATNumber);
  if (jsonData.seller.ID)
    formData.append("supplier_business_id", jsonData.seller.ID);
  if (jsonData.currency) formData.append("currency", jsonData.currency);
  if (jsonData.invoiceNumber)
    formData.append("invoice_number", jsonData.invoiceNumber);

  if (jsonData.totalWithoutVAT)
    formData.append("total_net", jsonData.totalWithoutVAT);
  if (jsonData.paymentTerms)
    formData.append("terms_of_payment", jsonData.paymentTerms);

  const response = await fetch(`${fennoaBaseUrl}/purchases_api/add`, {
    method: "POST",
    // @ts-ignore
    body: formData,
    headers: fennoaHeaders,
  });

  const respJson = (await response.json()) as any;
  console.log("Server Response:", respJson);
  if (response.ok) {
    if (
      respJson &&
      respJson.saved_ids &&
      respJson.saved_ids.purchase_invoice_id
    ) {
      return respJson.saved_ids.purchase_invoice_id;
    } else {
      return false;
    }
  } else {
    return false;
  }
};

async function uploadFile(
  invoiceId: string,
  filePath: string,
  fileName: string
) {
  const formData = new FormData();

  console.log("filePath", filePath);
  console.log("fileName", fileName);
  formData.append("file", fs.createReadStream(`${filePath}/${fileName}`), {
    filename: fileName,
  });

  try {
    const response = await fetch(
      `${fennoaBaseUrl}/purchases_api/do/upload_attachment/${invoiceId}`,
      {
        method: "POST",
        body: formData as any,
        headers: fennoaHeaders,
      }
    );

    const respJson = await response.json();
    console.log("respJson", respJson);

    console.log(`File uploaded successfully for invoice ${invoiceId}`);
    return response.ok;
  } catch (error) {
    console.error("Failed to upload file:", error);
  }
}

const processFiles = async (): Promise<void> => {
  console.log(`Starting to process files`);

  const files = await getFiles(`${DIR_IN}/`, ".json");
  console.log(`Currently ${files.length} files to process`);

  for (const file of files) {
    console.log(`Found file ${file}, checking if pdf exists`);
    const pdfBaseName = path.basename(file, ".json"); // Remove .json extension
    const jsonFilePath = path.join(DIR_IN, file);
    const pdfFilePath = path.join(DIR_IN, pdfBaseName);

    try {
      await access(pdfFilePath);
      console.log(`Found ${pdfBaseName}`);

      // Read and parse the JSON file
      const data = await readFile(jsonFilePath, { encoding: "utf8" });
      const jsonData = JSON.parse(data);
      //console.log(`Data from ${file}:`, jsonData);
      console.log(
        `Processing invoice ${jsonData.invoiceNumber} (${jsonData.seller.name})`
      );
      const fennoaPurchaseInvoiceId = await postPurchaseOrderToFennoa(jsonData);
      console.log("fennoaPurchaseInvoiceId", fennoaPurchaseInvoiceId);
      console.log(typeof fennoaPurchaseInvoiceId);
      if (!fennoaPurchaseInvoiceId) {
        throw new Error("could not post purchase invoice");
      }

      console.log(
        `Added new purchase invoice with id ${fennoaPurchaseInvoiceId}`
      );
      const fileUploadRes = await uploadFile(
        // @ts-ignore
        fennoaPurchaseInvoiceId,
        DIR_IN,
        pdfBaseName
      );
      if (!fileUploadRes) {
        throw new Error("could not post purchase invoice file (pdf)");
      }
      await fse.ensureDir(`${DIR_IN}/processed`);
      await fse.move(
        pdfFilePath,
        path.join(`${DIR_IN}/processed`, pdfBaseName)
      );
      await fse.move(jsonFilePath, path.join(`${DIR_IN}/processed`, file));
    } catch (err) {
      console.error(`${err}`);
    }
  }
};

export default processFiles;
