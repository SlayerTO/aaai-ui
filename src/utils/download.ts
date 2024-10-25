import type { ImageData } from '@/stores/outputs'
import { ElMessage } from 'element-plus';
import JSZip from 'jszip';
import { convertBase64ToBlob} from "../utils/base64"
import { useOptionsStore } from '@/stores/options';

export async function downloadMultipleWebp(outputs: ImageData[]) {
    const optionStore = useOptionsStore();
    const zip = new JSZip();

    ElMessage({
        message: `Downloading ${outputs.length} image(s)...`,
        type: 'info',
    })

    for (let i = 0; i < outputs.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {image, id, ...jsonData} = outputs[i];
        // Make a valid file name, and only get first 128 characters so we don't break the max file name limit
        const fileName = `${i}-${outputs[i].seed}-${outputs[i].prompt}`.replace(/[/\\:*?"<>]/g, "").substring(0, 128).trimEnd();

        // Create image file
        if (optionStore.pictureDownloadType == "PNG") 
        {
            zip.file(
                fileName + ".png",
                await convertBase64ToBlob(image, "image/png"),
            );
        }
        else if (optionStore.pictureDownloadType == "JPG")
        {
            zip.file(
                fileName + ".jpg",
                await convertBase64ToBlob(image, "image/jpeg"),
            );
        }
        else if (optionStore.pictureDownloadType == "JPEG")
        {
            zip.file(
                fileName + ".jpeg",
                await convertBase64ToBlob(image, "image/jpeg"),
            );
        }
        else if (optionStore.pictureDownloadType == "WEBP")
        {
            zip.file(
                fileName + ".webp",
                await convertBase64ToBlob(image, "image/webp"),
                { base64: true }
            );
        }
        
        if (optionStore.zipMetaData == "Enabled") {
            // Create JSON file
            zip.file(
                fileName + ".json",
                JSON.stringify(jsonData, undefined, 4) // Stringify JSON with pretty printing
            );
        }
    }

    const zipFile = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE"
    });
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(zipFile);
    downloadLink.download = "stable_horde.zip";
    downloadLink.click();
}

export async function downloadImage(output: ImageData, fileName: string) {    
    const store = useOptionsStore();
    const {image, id, ...jsonData} = output;
    const downloadLink = document.createElement("a");
    // Only get first 128 characters so we don't break the max file name limit
    let newFileName = fileName.replace(/[/\\:*?"<>]/g, "").substring(0, 128).trimEnd(); 

    if (store.pictureDownloadType == "PNG")  {
        newFileName += ".png";
        downloadLink.href = URL.createObjectURL(await convertBase64ToBlob(image, "image/png"));
    }
    else if (store.pictureDownloadType == "JPG") {          
        newFileName += ".jpg";
        downloadLink.href = URL.createObjectURL(await convertBase64ToBlob(image, "image/jpeg"));
    }
    else if (store.pictureDownloadType == "JPEG") {          
        newFileName += ".jpeg";
        downloadLink.href = URL.createObjectURL(await convertBase64ToBlob(image, "image/jpeg"));
    }
    else if (store.pictureDownloadType == "WEBP") {
        newFileName += ".webp";
        downloadLink.href = URL.createObjectURL(await convertBase64ToBlob(image, "image/webp"));
    }
    downloadLink.download = newFileName; 
    downloadLink.click();
    
    new Promise(f => setTimeout(f, 250)).then(() => {
        if (store.zipMetaData == "Enabled") {
            const blob: Blob = new Blob([JSON.stringify(jsonData, undefined, 4)], {type: 'text/json'});
            const jsonFileName = newFileName + ".json";
            const objectUrl: string = URL.createObjectURL(blob);
            const a: HTMLAnchorElement = document.createElement('a') as HTMLAnchorElement;
        
            a.href = objectUrl;
            a.download = jsonFileName;
            document.body.appendChild(a);
            a.click();        
        
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
        }
    });


}