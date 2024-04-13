
import Papa from 'papaparse';
const test=()=>{
    Papa.parse('../date/transactions.csv', {
        header: true,
        download: true,
        complete: (result) => {
          console.log(result.data);
        },
      });
}
test();