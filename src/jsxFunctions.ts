import ts from '../node_modules/typescript/lib/typescript.js';
import path from 'path';

// Initialize the TS Compiler API
const startNewExecution = (fileName: string) => {
  // Create a new instance of the TS Compiler for the given file
  const program = ts.createProgram([fileName], {
    target: ts.ScriptTarget.ES2015,
    module: ts.ModuleKind.CommonJS,
  });
  // Get the type checker for this program
  const typeChecker = program.getTypeChecker();

  // Filter files to remove declaration files and node_modules files 
  const files = program
    .getSourceFiles()
    .filter(
      (file: { fileName: string | string[]; isDeclarationFile: any; }) =>
        file.fileName.indexOf('node_modules') === -1 &&
        !file.isDeclarationFile,
    );

  // Reduce the file paths
  const [selectedFile] = files.filter(
    (file: { fileName: string; }) => path.normalize(file.fileName) === fileName,
  );

  // Return the type checker and the file
  return {
    typeChecker,
    selectedFile,
  };
}

// Function or Method type
type FunctionNode = ts.FunctionDeclaration | ts.MethodDeclaration;

// Function that returns if a node in AST is a function
const isFunctionNode = (node: FunctionNode): boolean => {
  // Node is either a function or a method or an arrow function
  return ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node);
}

// Function to recursively get all function nodes under a given node
const getFunctionNodes = (node: ts.Node): FunctionNode[] => {
  return node.getChildren().reduce(
    (acc: any[], child: any) => {
      // If current node is a function
      if (isFunctionNode(child as FunctionNode)) {
        // Add to the accumulator
        acc.push(child as FunctionNode);
      }

      // Recurse this over all children of the given node
      return [...acc, ...getFunctionNodes(child as FunctionNode)];
    },
    [] as FunctionNode[],
  );
}

type jsxFunctions = {
  [key: string]: boolean
};

// Get all function nodes that return JSX
const filterJsxFunctionsFromNode = (
  node: FunctionNode,
  typeChecker: ts.TypeChecker
): jsxFunctions => {
  // Get the type of the function node
  const typeOfFunction = typeChecker.getTypeAtLocation(node);
  // Get the symbol for the parent node
  const parentSym = typeChecker.getSymbolAtLocation(node.parent.getChildAt(0));
  const jsxFuncs: jsxFunctions = {}

  typeOfFunction.getCallSignatures().map((signature: { getReturnType: () => any; }) => {
    // Get the type signature
    const type = signature.getReturnType();
    // @ts-ignore
    const element = type.symbol?.escapedName, jsx = type.symbol?.parent?.escapedName;
    // Check if return type is JSX.Element
    if (element === "Element" && jsx === "JSX") {
      const name = (
        parentSym?.getEscapedName()?.toString() ||
        parentSym?.getName()?.toString() ||
        // @ts-ignore
        node.localSymbol?.escapedName ||
        // @ts-ignore
        node.symbol?.escapedName
      );
      // If function is not an anonymous function
      if (name !== "__function")
        // Add the function to the list of JSX returning functions
        jsxFuncs[name] = true;
    }
  });

  return jsxFuncs;
}

// Get all JSX returning function nodes from multiple nodes
const filterJsxFunctionsFromNodes = (
  nodes: FunctionNode[],
  typeChecker: ts.TypeChecker,
): jsxFunctions => {
  // For each node
  return nodes.reduce(
    (acc, node) => {
      return {
        ...acc,
        // Add the JSX returning function nodes under this node
        ...filterJsxFunctionsFromNode(node, typeChecker)
      }
    },
    {},
  );
}

// Get names of all JSX returning functions present in a file
export const getJsxFunctions = (fileName: string): jsxFunctions => {
  // Start the TS Compiler to generate AST of given file
  const { selectedFile, typeChecker } = startNewExecution(fileName);
  // Get all function nodes present in this AST
  const allFunctions = getFunctionNodes(selectedFile);

  // Filter out all JSX returning function nodes from these nodes
  return filterJsxFunctionsFromNodes(allFunctions, typeChecker);
}