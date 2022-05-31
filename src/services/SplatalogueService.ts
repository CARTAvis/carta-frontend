import axios, {AxiosInstance} from "axios";

export class SplatalogueService {
    private static BaseUrl = "https://splatalogue.online";
    private readonly axiosInstance: AxiosInstance;

    private static staticInstance: SplatalogueService;

    static get Instance() {
        if (!SplatalogueService.staticInstance) {
            SplatalogueService.staticInstance = new SplatalogueService();
        }
        return SplatalogueService.staticInstance;
    }

    private constructor() {
        this.axiosInstance = axios.create({baseURL: SplatalogueService.BaseUrl});
    }

    async aliveCheck(): Promise<boolean> {
        try {
            const {status} = await this.axiosInstance.head("");
            return status === 200;
        } catch (err) {
            return false;
        }
    }

    async query(freqMin: number, freqMax: number, intensityLimit?: number) {
        try {
            const url = SplatalogueService.ConstructUrl(freqMin, freqMax, intensityLimit);
            const response = await this.axiosInstance.get(url);
            return JSON.stringify(response.data);
        } catch (err) {
            return err;
        }
    }
    // This function is adapted quite strictly from the backend version, and should probably be
    // cleaned up at a later stage to make it flexible and more readable.
    private static ConstructUrl(freqMin: number, freqMax: number, intensityLimit?: number) {
        const base = "/c_export.php?&sid%5B%5D=&data_version=v3.0&lill=on";
        const intensityLimitString = isFinite(intensityLimit) ? "" : `&lill_cdms_jpl=${intensityLimit === 0 ? 0.000001 : intensityLimit}`;
        const lineListParameters =
            "&displayJPL=displayJPL&displayCDMS=displayCDMS&displayLovas=displayLovas" +
            "&displaySLAIM=displaySLAIM&displayToyaMA=displayToyaMA&displayOSU=displayOSU" +
            "&displayRecomb=displayRecomb&displayLisa=displayLisa&displayRFI=displayRFI";
        const lineStrengthParameters = "&ls1=ls1&ls2=ls2&ls3=ls3&ls4=ls4&ls5=ls5";
        const energyLevelParameters = "&el1=el1&el2=el2&el3=el3&el4=el4";
        const miscellaneousParameters = "&show_unres_qn=show_unres_qn&submit=Export&export_type=current&export_delimiter=tab&offset=0&limit=100000&range=on";

        // workaround to fix splatalogue frequency range parameter bug
        const freqMinString = freqMin === Math.floor(freqMin) ? freqMin.toFixed(1) : freqMin.toString();
        const freqMaxString = freqMax === Math.floor(freqMax) ? freqMax.toFixed(1) : freqMax.toString();
        const frequencyRangeString = `&frequency_units=MHz&from=${freqMinString}&to=${freqMaxString}`;
        return base + intensityLimitString + lineListParameters + lineStrengthParameters + energyLevelParameters + miscellaneousParameters + frequencyRangeString;
    }
}
