import * as vscode from 'vscode';
import OpenAI from 'openai'; // Use OpenAI-style API library

export function activate(context: vscode.ExtensionContext) {
    console.log('Natural Language Code Editor is active!');

    const openai = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY, // Use your OpenAI API key
        baseURL: 'https://api.deepseek.com', // Change base URL to use DeepSeek API
    });

    let disposable = vscode.commands.registerCommand('cocodr.editByPrompt', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor found.');
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const selectedText = document.getText(selection.isEmpty ? undefined : selection);

        const prompt = await vscode.window.showInputBox({
            prompt: 'Enter your natural language prompt to edit the code:',
            placeHolder: 'e.g., "Convert this function to use async/await"',
        });

        if (!prompt) {
            vscode.window.showErrorMessage('No prompt provided.');
            return;
        }

        try {
            // Enable streaming for chat completions
            const stream = await openai.chat.completions.create({
                model: 'deepseek-chat', // Use the appropriate model
                messages: [
                    { 
                        role: 'system', 
                        content: `You are a professional coder. Edit the following code to ensure it is directly compilable and functional. Return only the modified code with inline comments explaining key changes. Do not include any additional explanations or markdown formatting.\n\n${selectedText}` 
                    },
                    { 
                        role: 'user', 
                        content: `${prompt}. Ensure the returned code is directly compilable and functional.` 
                    },
                ],
                stream: true, // Enable streaming
            });

            let editedCode = '';
            const progress = vscode.window.createOutputChannel('Code Edit Progress');
            progress.show(true);

            for await (const chunk of stream) {
                const chunkContent = chunk.choices[0]?.delta?.content || '';
                editedCode += chunkContent;
                progress.append(chunkContent); // Show streaming progress in the output channel
            }

            if (!editedCode.trim()) {
                vscode.window.showErrorMessage('No response from the AI model.');
                return;
            }

            // Replace the selected text or entire document with the edited code
            editor.edit((editBuilder) => {
                if (selection.isEmpty) {
                    const firstLine = document.lineAt(0);
                    const lastLine = document.lineAt(document.lineCount - 1);
                    const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
                    editBuilder.replace(fullRange, editedCode);
                } else {
                    editBuilder.replace(selection, editedCode);
                }
            });

            vscode.window.showInformationMessage('Code edited successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Error editing code: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}