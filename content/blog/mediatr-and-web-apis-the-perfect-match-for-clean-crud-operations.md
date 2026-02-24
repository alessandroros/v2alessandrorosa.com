---
title: MediatR and Web APIs - The Perfect Match for Clean CRUD Operations
date_created: 2026-02-24T17:00:00Z
date_modified: 2026-02-24T17:00:00Z
description: Discover how MediatR transforms ASP.NET Core Web APIs with clean architecture, especially when working with Entity Framework Core for CRUD operations
---

## Introduction

If you've been building ASP.NET Core Web APIs for a while, you've probably encountered the challenge of keeping your controllers lean while maintaining clean separation of concerns. Enter [MediatR](https://github.com/jbogard/MediatR) - a simple mediator implementation that has become one of my favorite tools for building maintainable Web APIs.

In this post, I'll share why MediatR is such a great fit for Web APIs, especially when combined with Entity Framework Core for CRUD operations.

## What is MediatR?

MediatR is a lightweight library that implements the mediator pattern in .NET. It allows you to send requests and commands through a mediator, decoupling the sender from the receiver. Think of it as an in-process messaging system.

The core concept is simple:
- You define a **request** (command or query)
- You define a **handler** that processes that request
- MediatR routes the request to the appropriate handler

## Why MediatR is Perfect for Web APIs

### Thin Controllers

With MediatR, your controllers become incredibly thin. Instead of injecting multiple services and repositories, you only inject `IMediator`:

```csharp
[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IMediator _mediator;

    public ProductsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProductDto>> GetProduct(int id)
    {
        var query = new GetProductByIdQuery { Id = id };
        var result = await _mediator.Send(query);
        
        return result != null ? Ok(result) : NotFound();
    }

    [HttpPost]
    public async Task<ActionResult<ProductDto>> CreateProduct(CreateProductCommand command)
    {
        var result = await _mediator.Send(command);
        return CreatedAtAction(nameof(GetProduct), new { id = result.Id }, result);
    }
}
```

Clean, focused, and easy to read!

### Clear Separation of Concerns

Each operation gets its own request and handler. This follows the Single Responsibility Principle perfectly:

- **One handler = One responsibility**
- **Easy to test** - handlers can be tested in isolation
- **Easy to find** - looking for the "create product" logic? Find the `CreateProductHandler`
- **Easy to modify** - changes to one operation don't affect others

### Excellent Integration with EF Core

MediatR and Entity Framework Core work together beautifully. Let's look at a complete CRUD example.

## CRUD with MediatR and EF Core

### Setting Up

First, install the necessary packages:

```bash
dotnet add package MediatR
dotnet add package Microsoft.EntityFrameworkCore
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
```

Register MediatR in your `Program.cs`:

```csharp
builder.Services.AddMediatR(cfg => 
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
```

### Entity and DTOs

```csharp
// Entity
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// DTO
public class ProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
}
```

### Create Operation

```csharp
// Command
public class CreateProductCommand : IRequest<ProductDto>
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
}

// Handler
public class CreateProductHandler : IRequestHandler<CreateProductCommand, ProductDto>
{
    private readonly ApplicationDbContext _context;

    public CreateProductHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ProductDto> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        var product = new Product
        {
            Name = request.Name,
            Description = request.Description,
            Price = request.Price,
            Stock = request.Stock,
            CreatedAt = DateTime.UtcNow
        };

        _context.Products.Add(product);
        await _context.SaveChangesAsync(cancellationToken);

        return new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Description = product.Description,
            Price = product.Price,
            Stock = product.Stock
        };
    }
}
```

### Read Operations

For queries, I use EF Core projections to map directly to DTOs. This provides compile-time safety and better performance since EF Core generates SQL that selects only the required columns:

```csharp
// Query - Get by ID
public class GetProductByIdQuery : IRequest<ProductDto?>
{
    public int Id { get; set; }
}

public class GetProductByIdHandler : IRequestHandler<GetProductByIdQuery, ProductDto?>
{
    private readonly ApplicationDbContext _context;

    public GetProductByIdHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ProductDto?> Handle(GetProductByIdQuery request, CancellationToken cancellationToken)
    {
        // Using projection - EF Core translates this to SELECT only the needed columns
        return await _context.Products
            .AsNoTracking()
            .Where(p => p.Id == request.Id)
            .Select(p => new ProductDto  // Projection happens in SQL
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                Price = p.Price,
                Stock = p.Stock
            })
            .FirstOrDefaultAsync(cancellationToken);
    }
}

// Query - Get All
public class GetAllProductsQuery : IRequest<List<ProductDto>>
{
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public class GetAllProductsHandler : IRequestHandler<GetAllProductsQuery, List<ProductDto>>
{
    private readonly ApplicationDbContext _context;

    public GetAllProductsHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ProductDto>> Handle(GetAllProductsQuery request, CancellationToken cancellationToken)
    {
        var products = await _context.Products
            .AsNoTracking()
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(p => new ProductDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                Price = p.Price,
                Stock = p.Stock
            })
            .ToListAsync(cancellationToken);

        return products;
    }
}
```

### Update Operation

```csharp
// Command
public class UpdateProductCommand : IRequest<ProductDto?>
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
}

// Handler
public class UpdateProductHandler : IRequestHandler<UpdateProductCommand, ProductDto?>
{
    private readonly ApplicationDbContext _context;

    public UpdateProductHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ProductDto?> Handle(UpdateProductCommand request, CancellationToken cancellationToken)
    {
        var product = await _context.Products
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        if (product == null)
            return null;

        product.Name = request.Name;
        product.Description = request.Description;
        product.Price = request.Price;
        product.Stock = request.Stock;
        product.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Description = product.Description,
            Price = product.Price,
            Stock = product.Stock
        };
    }
}
```

### Delete Operation

```csharp
// Command
public class DeleteProductCommand : IRequest<bool>
{
    public int Id { get; set; }
}

// Handler
public class DeleteProductHandler : IRequestHandler<DeleteProductCommand, bool>
{
    private readonly ApplicationDbContext _context;

    public DeleteProductHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteProductCommand request, CancellationToken cancellationToken)
    {
        var product = await _context.Products
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        if (product == null)
            return false;

        _context.Products.Remove(product);
        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}
```

## Advanced Patterns with MediatR

### Validation with FluentValidation

MediatR plays exceptionally well with FluentValidation through pipeline behaviors:

```csharp
public class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
    {
        _validators = validators;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        if (!_validators.Any())
            return await next();

        var context = new ValidationContext<TRequest>(request);
        var validationResults = await Task.WhenAll(
            _validators.Select(v => v.ValidateAsync(context, cancellationToken)));

        var failures = validationResults
            .SelectMany(r => r.Errors)
            .Where(f => f != null)
            .ToList();

        if (failures.Count != 0)
            throw new ValidationException(failures);

        return await next();
    }
}

// Validator example
public class CreateProductValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Price).GreaterThan(0);
        RuleFor(x => x.Stock).GreaterThanOrEqualTo(0);
    }
}
```

### Logging Pipeline

```csharp
public class LoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;

    public LoggingBehavior(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
    {
        _logger = logger;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;
        _logger.LogInformation("Handling {RequestName}", requestName);

        var response = await next();

        _logger.LogInformation("Handled {RequestName}", requestName);
        return response;
    }
}
```

Register behaviors in `Program.cs`:

```csharp
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
});
```

### Transaction Management

```csharp
public class TransactionBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly ApplicationDbContext _context;

    public TransactionBehavior(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        if (_context.Database.CurrentTransaction != null)
            return await next();

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            var response = await next();
            await transaction.CommitAsync(cancellationToken);
            return response;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
```

## Benefits in Production

After using MediatR extensively in production Web APIs with EF Core, here's what stands out:

### 1. **Testability**

Handlers are incredibly easy to test in isolation:

```csharp
[Fact]
public async Task CreateProductHandler_ShouldCreateProduct()
{
    // Arrange
    var options = new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(databaseName: "TestDb")
        .Options;

    await using var context = new ApplicationDbContext(options);
    var handler = new CreateProductHandler(context);

    var command = new CreateProductCommand
    {
        Name = "Test Product",
        Price = 99.99m,
        Stock = 10
    };

    // Act
    var result = await handler.Handle(command, CancellationToken.None);

    // Assert
    Assert.NotNull(result);
    Assert.Equal("Test Product", result.Name);
}
```

### 2. **Maintainability**

Finding and modifying business logic is straightforward. Need to change how products are created? Go to `CreateProductHandler`. No hunting through layers of services.

### 3. **Code Organization**

Our project structure looks like this:

```
Features/
├── Products/
│   ├── Commands/
│   │   ├── CreateProduct/
│   │   │   ├── CreateProductCommand.cs
│   │   │   ├── CreateProductHandler.cs
│   │   │   └── CreateProductValidator.cs
│   │   ├── UpdateProduct/
│   │   └── DeleteProduct/
│   └── Queries/
│       ├── GetProductById/
│       └── GetAllProducts/
```

Everything related to a feature is co-located. This is fantastic for maintenance and onboarding new developers.

### 4. **Performance**

With EF Core's `AsNoTracking()` for queries and proper use of async/await, performance is excellent. The MediatR overhead is negligible - we're talking microseconds.

### 5. **Scalability**

As your API grows, adding new endpoints is a breeze. Create a new command/query and handler, wire it up in the controller, and you're done. No need to modify existing services or worry about breaking other features.

## Real-World Tips

### Use Projections for Compile-Time Safety

I prefer manual mapping with EF Core projections over reflection-based mappers like AutoMapper. The main reason? **Compile-time safety**. When using AutoMapper, mapping errors only surface at runtime, which can lead to production issues that could have been caught during compilation.

Here's how to use projections effectively:

**For Queries (Read Operations):**

```csharp
public class GetAllProductsHandler : IRequestHandler<GetAllProductsQuery, List<ProductDto>>
{
    private readonly ApplicationDbContext _context;

    public GetAllProductsHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ProductDto>> Handle(GetAllProductsQuery request, CancellationToken cancellationToken)
    {
        return await _context.Products
            .AsNoTracking()
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(p => new ProductDto  // Projection directly in the query
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                Price = p.Price,
                Stock = p.Stock
            })
            .ToListAsync(cancellationToken);
    }
}
```

**Benefits of projections:**
- **Compile-time safety**: If you rename a property, the compiler catches it immediately
- **Performance**: EF Core translates the projection to SQL, selecting only needed columns
- **Explicit**: You can see exactly what's being mapped without jumping to configuration files
- **Refactoring friendly**: IDE refactoring tools work perfectly

**For Commands (Write Operations):**

For commands, keep the mapping explicit:

```csharp
public class CreateProductHandler : IRequestHandler<CreateProductCommand, ProductDto>
{
    private readonly ApplicationDbContext _context;

    public CreateProductHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ProductDto> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        var product = new Product
        {
            Name = request.Name,
            Description = request.Description,
            Price = request.Price,
            Stock = request.Stock,
            CreatedAt = DateTime.UtcNow
        };

        _context.Products.Add(product);
        await _context.SaveChangesAsync(cancellationToken);

        // Explicit mapping back to DTO
        return new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Description = product.Description,
            Price = product.Price,
            Stock = product.Stock
        };
    }
}
```

Yes, it's more verbose than AutoMapper, but the benefits far outweigh the extra typing:
- No runtime mapping exceptions
- Better IDE support and intellisense
- Easier to debug
- Clear and explicit code

### Always Use CancellationToken

Pass the `CancellationToken` to EF Core methods. This ensures proper cancellation propagation when clients disconnect.

### Consider CQRS

MediatR naturally encourages Command Query Responsibility Segregation (CQRS). Commands modify state, queries read state. This separation improves code clarity and can lead to performance optimizations.

## Conclusion

MediatR has become an essential part of my ASP.NET Core Web API toolkit. Its integration with Entity Framework Core for CRUD operations is seamless, and the resulting code is clean, testable, and maintainable.

The combination of thin controllers, isolated handlers, and powerful pipeline behaviors creates an architecture that scales beautifully as your application grows. If you're building Web APIs with .NET and haven't tried MediatR yet, I highly recommend giving it a shot.

Your future self (and your teammates) will thank you! 🚀

## Resources

- [MediatR GitHub Repository](https://github.com/jbogard/MediatR)
- [MediatR Documentation](https://github.com/jbogard/MediatR/wiki)
- [Entity Framework Core Documentation](https://learn.microsoft.com/en-us/ef/core/)
- [FluentValidation](https://docs.fluentvalidation.net/)

