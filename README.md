# excelifier-fennoa

This repo consists of little Node.JS application which will insert new purchase invoices to Fennoa accounting service.

First, make sure you have .env file (or otherwise defined environment variables). Take a look at `.env.example` for example what should be there.

Then, put two files to `data_in` folder (original pdf and JSON which you got from Excelifier) and run

```
yarn start
```

This will then digest those files, add purchase order based on the data on .json file and then insert PDF file as an attachment.