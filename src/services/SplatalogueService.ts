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
}
