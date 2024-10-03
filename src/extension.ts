// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from "fs";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "code-context-poc" is now active!');

	const config = {
		"NORMAL_LINES_LOOK_BEHIND": 50,
		"ENHANCED_LINES_LOOK_BEHIND": 50,
		"ENHANCED_LINES_LOOK_AHEAD": 5,
		"ENHANCED_LINES_CONTENT_LIMIT": 50,
		"ENHANCED_LINES_FOLD_BEGIN_CONTENT_LIMIT": 2,
		"ENHANCED_LINES_FOLD_END_CONTENT_LIMIT": 5,
	};

	const isValidLocation = (location: any) => {
		return location.targetRange
			&& !location.targetRange.isSingleLine
			&& isOwnMethod(location.targetUri);
	};
	const isOwnMethod = (uri: vscode.Uri) => {
		return !uri.path.includes("node_modules");
	};
	const SINGLE_LINE_COMMENT = "//";
	const removeEmptyLines = (content: string) => {
		let lines = content.split("\n");
		lines = lines.filter((line: string) => line.trim().length > 0);
		return lines.join("\n");
	};
	const foldToNLines = (content: string, linesAtBegining: number, linesAtEnd: number) => {
		let lines: string[] = removeEmptyLines(content).split("\n");
		// remove empty lines and trim

		if (lines.length <= linesAtBegining + linesAtEnd) {
			return content;
		}
		let foldedContent = [
			...lines.slice(0, linesAtBegining),
			`${SINGLE_LINE_COMMENT} ...`,
			...lines.slice(-linesAtEnd)
		].join("\n");
		return foldedContent;
	};
	const getNLines = (activeTextEditor: vscode.TextEditor, startLine: number, linesCount: number) => {
		let lines = [];
		for (let lineIndex = 0; lineIndex < linesCount; lineIndex++) {
			lines.push(activeTextEditor.document.lineAt(startLine + lineIndex).text);
		}
		return lines.join("\n");
	};
	const isOverlapping = (document: vscode.TextDocument, activeTextEditor: vscode.TextEditor, curPos: vscode.Position, rangeStart: number, rangeEnd: number) => {
		if (document.uri.path === activeTextEditor.document.uri.path) {
			let start = Math.max(0, curPos.line - config.NORMAL_LINES_LOOK_BEHIND),
				end = curPos.line;
			return !(end < rangeStart || rangeEnd < start); // overlapping
		}
		return false;
	};
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('code-context-poc.helloWorld', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// vscode.window.showInformationMessage('Hello World from code-context-poc!');
		// await vscode.commands.executeCommand('editor.action.triggerSuggest');
		// await vscode.commands.executeCommand('acceptSelectedSuggestion');
		let activeTextEditor = vscode.window.activeTextEditor;
		let seenCode = new Set();
		if (activeTextEditor) {
			const curPos = activeTextEditor.selection.active;
			let getMethodContext = async (document: any, position: vscode.Position) => {
				let symbols: any = await vscode.commands.executeCommand(
					'vscode.executeDocumentSymbolProvider',
					document.uri
				);
				let relevantText: String = '';
				console.log("symbols", symbols);
				if (!symbols) {
					return '';
				}
				// @TODO: append line information if needed
				relevantText = symbols
					.filter((symbol: any) =>
						symbol.range.start.line <= position.line
						&& position.line <= symbol.range.end.line)
					.filter((symbol: any) =>
						!isOverlapping(document, activeTextEditor, curPos, symbol.range.start.line, symbol.range.end.line))
					.map((symbol: any) => {
						let text = foldToNLines(
							document.getText(symbol.range).trim(),
							config.ENHANCED_LINES_FOLD_BEGIN_CONTENT_LIMIT,
							config.ENHANCED_LINES_FOLD_END_CONTENT_LIMIT);
						text = text.trim();
						return text;
					})
					.filter((text: string) => {
						if (!seenCode.has(text)) {
							seenCode.add(text);
							return true;
						}
						return false;
					})
					.join("\n");
				if (relevantText.length > 0) {
					relevantText = [`${SINGLE_LINE_COMMENT} ` + document.uri, relevantText].join("\n");
				}
				console.log("getMethodContext", relevantText);
				return relevantText;
			};

			let getDefinitionContext = async () => {
				let positions = [curPos];
				let relevantText: string = "";
				for (let diff = 0; diff < config.ENHANCED_LINES_LOOK_BEHIND && (curPos.line - diff) >= 0; diff++) {
					let lineContent: string = activeTextEditor.document.lineAt(curPos.line - diff).text;
					// words before '.' or '(' be an object or function calls, will help in providing more context
					for (let i = 0; i < lineContent.length; i++) {
						let ch = lineContent.charAt(i);
						// if (ch == "." || ch == '(' || ch == '=' || ch == '{' || ch == '[') {
						if (/[\.\(\)*+=\-\[\];,/{}":<>\?]/g.test(ch)) {
							positions.push(new vscode.Position(Math.max(0, curPos.line - diff), Math.max(0, i - 1)));
						}
					}
				}
				console.log("positions", positions);
				for (let position of positions) {
					let locations: any = await vscode.commands.executeCommand(
						'vscode.executeDefinitionProvider',
						activeTextEditor.document.uri,
						position
					);
					console.log("locations", locations);
					for (let location of locations) {
						if (isValidLocation(location)) {
							console.log("valid location", location);
							let document: any = await vscode.workspace.openTextDocument(location.targetUri);
							if (isOverlapping(document, activeTextEditor, curPos, location.targetRange.start.line, location.targetRange.end.line)) {
								continue;
							}
							let text = foldToNLines(
								document.getText(location.targetRange),
								config.ENHANCED_LINES_FOLD_BEGIN_CONTENT_LIMIT,
								config.ENHANCED_LINES_FOLD_END_CONTENT_LIMIT);
							text = text.trim();
							if (text.length > 0 && !seenCode.has(text)) {
								seenCode.add(text);
								relevantText += [`${SINGLE_LINE_COMMENT} ` + document.uri, text, ""].join("\n");
							}
						}
					}
				}
				console.log("getDefinitionContext", relevantText);
				return relevantText;
			};

			let combinedCodeContext: string = [
				await getDefinitionContext(),
				await getMethodContext(activeTextEditor.document, curPos)]
				.join("\n");
			console.log("combinedCodeContext", combinedCodeContext);

			let betterCodeContext: string = combinedCodeContext
				.split("\n")
				.slice(0, config.ENHANCED_LINES_CONTENT_LIMIT)
				.filter((line: string) => line.trim().length > 0)
				.join("\n");

			let getNormalContext = () => {
				return ["// " + activeTextEditor.document.uri,
				removeEmptyLines(activeTextEditor.document.getText(new vscode.Range(
					Math.max(0, curPos.line - config.NORMAL_LINES_LOOK_BEHIND), 0, curPos.line, curPos.character)))].join("\n");
			};
			let normalContext = getNormalContext();
			// final enhanced code context includes better and normal code context
			let finalCodeContext = removeEmptyLines([betterCodeContext, normalContext].join("\n"));

			console.log("-----BETTER CONTEXT BEGIN-----------");
			console.log(finalCodeContext);
			console.log("-----BETTER CONTEXT END-----------");
			fs.writeFile('/tmp/enhanced.txt', finalCodeContext, (err) => console.log);
			fs.writeFile('/tmp/normal.txt', normalContext, (err) => console.log(err));
			compareCodeCompletion({ "enhanced": finalCodeContext, "normal": normalContext });
		}
	});
	let compareCodeCompletion = (compareJson: any) => {
		let system_prompt = `
		You are an AI assistant that completes programming language code. 
	
		Given a code below, complete the code when it is incomplete and you are confident that you know the right answer. 
		Make sure there is no syntax error when it is combined with the given code.
		
		**Instructions:
			Prefer completing:
				- If the current line is incomplete
				- Adding new words/lines at logical points (after function definitions, loop/conditional statements)
				- Right after starting a new block of code (e.g., function, class, or control structure).
	
			Consider these factors for multi-line vs single-line completions:
				- Context completeness: If the existing code appears to be at the beginning or in the middle of a block, or function (multi-line completion)
				- Syntax indicators: The presence of block-starting symbols at the end of the current context (multi-line completion)
				- Keywords: Certain keywords that typically introduce new blocks or structures (multi-line completion)
				- Indentation: New level? (multi-line)
				- Code patterns: Common multi-line structures? (multi-line)
				- Statement/comment incompleteness (single-line)
				- Scope analysis: Understand the current scope (global, class, function) and the programming language (Python, Javascript, C++, ...) 
					to determine whether a multi-line, or single-line completion is more appropriate.
	
		**Output:
			Your response must be in the following format:
			{{
				"completion": Only provide the exact code completion. 
					Do not include any explanations, confidence statements, or extra information. 
					If you're not confident, do not hallucinate, return only 'NONE'.
					Before generating any response, check whether you are at the beginning/middle/end of a line/comment, and then follow the instructions.
					Make sure there is no syntax error when it is combined with the given code.
			}}
			Do not give any extra explanation.
			Do not re-write the whole code.
			The following example is a guidance for your response.
			The Code part will be given to you. Generate the Output part only.
	
		**Examples:
		{examples}
		   
		Code: {code}
		Output: 
	`;
		for (let key of Object.keys(compareJson)) {
			let content = compareJson[key];
			const options = {
				method: 'POST',
				headers: { Authorization: 'Bearer <API_KEY>', 'Content-Type': 'application/json' },
				body: JSON.stringify({
					"model":"accounts/fireworks/models/llama-v3p1-8b-instruct",
					"messages":[
						{"role":"system","content":system_prompt},
						{"role":"user","content":content}],
					"max_tokens":512,
					"temperature":0,
					"stream":true,
					"context_length_exceeded_behavior":"truncate",
					"user":"<string>"
				})
			};

			fetch('https://api.fireworks.ai/inference/v1/chat/completions', options)
				.then(response => response.text())
				.then((response:any) => {
					fs.writeFile(`/tmp/${key}_completion.txt`, response, (err) => console.log);
				})
				.catch(err => console.error(err));

				
		}

	};

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
