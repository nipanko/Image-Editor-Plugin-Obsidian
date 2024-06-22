import { App, Plugin, PluginSettingTab, Setting, MarkdownView, WorkspaceLeaf, TFile, Notice, Modal } from 'obsidian';

export default class DrawOverImagePlugin extends Plugin {
    async onload() {
        console.log('loading Draw Over Image plugin');

        this.addRibbonIcon('pencil', 'Draw Over Image', () => {
            this.startDrawing();
        });

        this.addCommand({
            id: 'start-drawing',
            name: 'Start Drawing on Image',
            callback: () => this.startDrawing(),
        });
    }

    onunload() {
        console.log('unloading Draw Over Image plugin');
    }

    async startDrawing() {
        const activeLeaf = this.app.workspace.activeLeaf;
        const activeFile = this.app.workspace.getActiveFile();
        
        if (!activeFile) {
            new Notice('No active file found.');
            return;
        }

        if (activeFile.extension !== 'md') {
            new Notice('Active file is not a markdown file.');
            return;
        }

        try {
            const content = await this.app.vault.read(activeFile);
            const matches = content.match(/!\[(.*?)\]\((.*?)\)|!\[\[(.*?)\]\]/);

            if (!(matches && (matches[2] || matches[3]))) {
                new Notice('No image found in the active file.');
                return;
            }

            const imagePath = matches[2] || matches[3];
            const imageFile = this.app.vault.getAbstractFileByPath(imagePath);

            if (!(imageFile instanceof TFile && imageFile.extension.match(/(png|jpg|jpeg)/))) {
                new Notice('No valid image found in the active file.');
                return;
            }

            const imageUrl = this.app.vault.getResourcePath(imageFile);
            this.openDrawingModal(imageUrl, imageFile);
        } catch (error) {
            console.error('Error reading active file:', error);
            new Notice('Failed to read active file.');
        }
    }

    openDrawingModal(imageUrl: string, imageFile: TFile) {
        const modal = new DrawingModal(this.app, imageUrl, imageFile);
        modal.open();
    }

    
}

class DrawingModal extends Modal {
    imageUrl: string;
    imageFile: TFile;
    currentColor: string = '#000000'; // Default color is black
    isErasing: boolean = false;

    

    constructor(app: App, imageUrl: string, imageFile: TFile) {
        super(app);
        this.imageUrl = imageUrl;
        this.imageFile = imageFile;
    }

    async saveImage(imageFile: TFile, imageData: Buffer): Promise<void> {
        try {
            await this.app.vault.modifyBinary(imageFile, imageData);
            new Notice('Image saved successfully.');
        } catch (error) {
            console.error('Error saving image:', error);
            new Notice('Failed to save image.');
        }
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Draw Over Image' });

        // Add color picker
        const colorPickerLabel = contentEl.createEl('label', { text: 'Choose Color: ' });
        const colorPicker = contentEl.createEl('input', { type: 'color', value: this.currentColor });
        colorPicker.oninput = (event) => {
            this.isErasing = false; // Disable erasing when color is changed
            this.currentColor = (event.target as HTMLInputElement).value;
            console.log(`Color selected: ${this.currentColor}`);
        };
        colorPickerLabel.appendChild(colorPicker);

        // Add eraser button
        const eraserButton = contentEl.createEl('button', { text: 'Eraser' });
        eraserButton.onclick = () => {
            this.isErasing = true;
            console.log('Eraser selected');
        };

        // Add canvas for drawing
        const canvas = contentEl.createEl('canvas', { attr: { width: '800', height: '600' } });
        const context = canvas.getContext('2d');
        const image = new Image();
        image.src = this.imageUrl;

        image.onload = () => {
            console.log('Image loaded successfully');
            //@ts-ignore
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            let drawing = false;

            canvas.onmousedown = () => {
                console.log('Mouse down');
                drawing = true;
            };
            canvas.onmouseup = () => {
                console.log('Mouse up');    
                drawing = false;
            };
            canvas.onmousemove = (event) => {
                if (!drawing) return;
                const rect = canvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                console.log(`Drawing at: (${x}, ${y})`);
                //@ts-ignore
                context.save(); // Save the current drawing state
                
                if (this.isErasing) {
                    // Use destination-out to erase (make transparent)
                    //@ts-ignore
                    context.globalCompositeOperation = 'destination-out';
                    //@ts-ignore
                    context.fillStyle = 'rgba(0, 0, 0, 1)'; // Fully opaque color
                } else {
                    // Drawing with the current color
                    //@ts-ignore
                    context.globalCompositeOperation = 'source-over';
                    //@ts-ignore
                    context.fillStyle = this.currentColor;
                }
                
                // Draw a small rectangle to simulate a pencil or eraser stroke
                //@ts-ignore
                context.fillRect(x, y, 4, 4); // Adjust size as needed
                //@ts-ignore
            
                context.restore(); // Restore the previous drawing state
            };
            
            
        };

        image.onerror = (e) => {
            console.error('Image failed to load', e);
        };

        // Add save button
        const saveButton = contentEl.createEl('button', { text: 'Save' });
        saveButton.onclick = async () => {
            const dataUrl = canvas.toDataURL('image/png');
            const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');

            await this.saveImage(this.imageFile, buffer);
            this.close();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
