import { setState, getState, scrollToState, tryRun, subscribeRefreshButton } from "./util/common";

function folderChange(folder: string) {
    const elements = document.getElementsByClassName('techfolder');
    setState({ folder: folder });

    for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLDivElement;
        element.style.display = element.id === folder ? 'block' : 'none';
    }
}

window.addEventListener('load', tryRun(function() {
    const element = document.getElementById('folderSelector') as HTMLSelectElement;
    const folder = getState().folder || element.value;
    element.value = folder;
    folderChange(folder);
    scrollToState();

    subscribeRefreshButton();

    element.addEventListener('change', function() {
        folderChange(this.value);
    });
}));
