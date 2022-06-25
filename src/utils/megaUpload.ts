import fs from 'fs';
import path from 'path';
import { Storage } from 'megajs';

export const megaUpload = async (input: string, fileName: string) => {
  try {
    const tempFilePath = path.join(__dirname, fileName);

    // create temp file with formatted json
    fs.writeFileSync(tempFilePath, input);
    // read file as buffer
    const jsonFile = fs.readFileSync(tempFilePath);
    // delete temp file
    fs.unlinkSync(tempFilePath);

    // send role template as json
    console.log('connecting storage...');
    const storage = await new Storage({
      email: process.env.MEGA_EMAIL,
      password: process.env.MEGA_PASSWORD,
      autologin: true,
      autoload: true,
      keepalive: true,
    }).ready;

    console.log('search for folder');
    let folder = storage.root.children?.find(
      (e) => e.name === process.env.MEGA_DIR
    );

    // create folder if it doesn't exist
    console.log('create folder if not exist');
    if (!folder) folder = await storage.mkdir({ name: process.env.MEGA_DIR });

    console.log('upload file');
    const file = await storage.upload(fileName, jsonFile).complete;

    console.log('move file');
    await file.moveTo(folder);

    console.log('create link');
    return await file.link({ noKey: false });
  } catch (error) {
    console.log(error);
    // catch error and send it to user
    return 'Something went wrong while uploading the file.';
  }
};
