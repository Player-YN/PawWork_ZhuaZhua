using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Validation;

if (args.Length < 1)
{
    Console.Error.WriteLine("usage: PptxOpenXmlValidate <file.pptx>");
    return 2;
}

var path = Path.GetFullPath(args[0]);
using var doc = PresentationDocument.Open(path, false);
var validator = new OpenXmlValidator(FileFormatVersions.Office2016);
var errors = validator.Validate(doc).ToList();
foreach (var err in errors)
{
    Console.WriteLine($"{err.Part?.Uri} {err.Path?.XPath}: {err.Description}");
}
Console.WriteLine($"ERROR_COUNT={errors.Count}");
return errors.Count == 0 ? 0 : 1;
