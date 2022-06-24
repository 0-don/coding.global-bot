import fs from 'fs';
import { Storage } from 'megajs';

export const megaUpload = async (input: string, fileName: string) => {
  try {
    // create temp file with formatted json
    fs.writeFileSync(fileName, input);
    // read file as buffer
    const jsonFile = fs.readFileSync(fileName);
    // delete temp file
    fs.unlinkSync(fileName);

    // send role template as json
    const storage = await new Storage({
      email: process.env.MEGA_EMAIL,
      password: process.env.MEGA_PASSWORD,
    }).ready;

    let folder = storage.root.children?.find(
      (e) => e.name === process.env.MEGA_DIR
    );
    
    // create folder if it doesn't exist
    if (!folder) folder = await storage.mkdir({ name: process.env.MEGA_DIR });

    const file = await storage.upload(fileName.replace('./', ''), jsonFile)
      .complete;

    await file.moveTo(folder);

    return await file.link({ noKey: false });
  } catch (error) {
    console.log(error);
    // catch error and send it to user
    return 'Something went wrong while uploading the file.';
  }
};
