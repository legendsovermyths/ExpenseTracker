import * as FileSystem from 'expo-file-system';


const addAccount=async(bankData)=>{
    const bankFilePath = FileSystem.documentDirectory + 'data/accounts.csv';
    const newRowData=[bankData.id,bankData.name,bankData.amount];
    try {
        let existingContent = '';
        const fileExists = await FileSystem.getInfoAsync(bankFilePath);
        if (fileExists.exists) {
            existingContent = await FileSystem.readAsStringAsync(bankFilePath);
        }
        console.log(existingContent);
        const newRow = newRowData.join(',') + '\n';
        console.log(newRow);
        const updatedContent = existingContent + newRow;

        await FileSystem.writeAsStringAsync(bankFilePath, updatedContent, {
        encoding: FileSystem.EncodingType.UTF8,
        });

        console.log('Row appended successfully.');
    } catch (error) {
        console.error('Error appending row:', error);
  }
}
const deleteAccount = async (idToDelete) => {
    const bankFilePath = FileSystem.documentDirectory + 'data/accounts.csv';
  
    try {
      let existingContent = '';
      const fileExists = await FileSystem.getInfoAsync(bankFilePath);
      if (fileExists.exists) {
        existingContent = await FileSystem.readAsStringAsync(bankFilePath);
      }
  
      const rows = existingContent.split('\n');

      const updatedRows = rows.filter((row) => {
        const rowData = row.split(',');
        return rowData[0] !== idToDelete;
      });
  
      const updatedContent = updatedRows.join('\n');
  
      await FileSystem.writeAsStringAsync(filePath, updatedContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
  
      console.log('Row deleted successfully.');
    } catch (error) {
      console.error('Error deleting row:', error);
    }
  };

export {addAccount,deleteAccount}
