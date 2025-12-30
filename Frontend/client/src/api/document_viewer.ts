import { API_BASE_URL } from "../../config/api.config";

export const docViewer = {
  viewFile: async (filePath: string) => {
    return `${API_BASE_URL}/file/?path=${encodeURIComponent(filePath)}`;
  },
  onViewFile: async (path: string) => {
    const viewerUrl = await docViewer.viewFile(path);
    window.open(viewerUrl, "_blank");
  },
};
