import { EventBus } from '../v2/eventbus.js';
import { UtilServer } from './serverutil.js';

const os = require('os');
class UpdateAvailable{
    constructor(args = {version,downloadLink}){
        Object.assign(this,args);
    }
}
export class AutoUpdater{
    constructor(app){
        this.app = app;
        EventBus.register(this);
    }    
    get isWindowsSystem(){
        return os.platform() == "win32";
    }
    get isMacSystem(){
        return os.platform() == "darwin";
    }
    get updateFileExtension(){
        if(this.isWindowsSystem){
            return "exe";
        }
        if(this.isMacSystem){
            return "dmg";
        }
        return "AppImage";
    }
    get updateFileName(){
        return `joinupdatefile.${this.updateFileExtension}`;
    }
    get appInfo(){
        const response = {platform:os.platform(),version:this.app.getVersion()};
        response.isWindowsSystem = this.isWindowsSystem;
        response.isMacSystem = this.isMacSystem;
        response.isLinuxSystem = !this.isWindowsSystem && !this.isMacSystem;
        response.ipAddress = UtilServer.myIp;
        return response;
    }
    async checkForUpdate(){
        const available = await this.latestDownloadUpdateAvailable;
        if(!available) return;
        
        try{
            const fs = require('fs');
            fs.unlinkSync(await UtilServer.getUserDataFilePath(this.updateFileName));
        }catch(error){
            console.log("Error deleting last update file",error);
        }
        EventBus.post(available);
    }
    get latestDownloadUpdateAvailable(){
        return (async () => {
            
            try{
                const fetch = require('node-fetch');
                const appInfo = await this.appInfo;
                let appVersion = appInfo.version;
                //appVersion = "0.0.1";
                console.log("App Info", appInfo);
                const fetchResult = await fetch("https://raw.githubusercontent.com/joaomgcd/JoinDesktop/master/package.json");
                const packageInfoFromGithub = await fetchResult.json();
                const versionFromGithub = packageInfoFromGithub.version;
                console.log("Package version from github", versionFromGithub);

                if(parseFloat(versionFromGithub) <= parseFloat(appVersion)) return null;


                let downloadLinkEnd = `Join.Desktop.Setup.${versionFromGithub}.exe`;
                if(appInfo.isMacSystem){
                    downloadLinkEnd = `Join.Desktop-${versionFromGithub}.dmg`;
                }
                if(appInfo.isLinuxSystem){
                    downloadLinkEnd = `Join.Desktop-${versionFromGithub}.AppImage`;
                }
                const downloadLink = `https://github.com/joaomgcd/JoinDesktop/releases/download/v${versionFromGithub}/${downloadLinkEnd}`;
                const urlExists = (await fetch(downloadLink,{method:"HEAD"})).status != 404
                console.log("URL exists",downloadLink,urlExists)
                if(!urlExists) return null;

                return new UpdateAvailable({version:versionFromGithub,downloadLink});
            }catch(error){
                console.error("Error when checking for updates",error);
                return null;
            }
        })();
    }
    
    async onRequestInstallLatestUpdate(){
        const latest = await this.latestDownloadUpdateAvailable;
        if(!latest) return;

        const downloadLink = latest.downloadLink;
        const fileName = this.updateFileName;
        console.log("Downloading update", downloadLink, fileName);
        const file = await UtilServer.downloadFile(downloadLink,fileName)
        UtilServer.openUrlOrFile(file,this.isMacSystem);
        this.app.quit();
    }

}